import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Capture-on-pickup flow:
// 1. Capture the Stripe PaymentIntent first (fail fast before any DB writes).
// 2. Insert a wallet_transactions `debit` row to finalise the audit trail (idempotent).
// 3. Mark payments.status = 'captured' and orders.status = 'completed'.
//
// The wallet balance was already reduced at provision time — no second deduction here.
export async function captureOrder(
  db: SupabaseClient,
  stripe: Stripe,
  orderId: string,
  cashierId?: string
): Promise<{ ok: true } | { error: string; status: number }> {
  const { data: payment } = await db
    .from('payments')
    .select('id, stripe_payment_intent_id, wallet_units_provisioned, status')
    .eq('order_id', orderId)
    .maybeSingle()

  if (!payment) {
    return { error: 'Payment record not found', status: 500 }
  }

  // Step 1: Stripe capture (before DB writes so we can bail cleanly on failure).
  // Swallow payment_intent_unexpected_state — means it's already captured or cancelled.
  if (payment.stripe_payment_intent_id) {
    try {
      await stripe.paymentIntents.capture(payment.stripe_payment_intent_id)
    } catch (e: unknown) {
      const stripeErr = e as { code?: string }
      if (stripeErr?.code !== 'payment_intent_unexpected_state') {
        console.error('[captureOrder] stripe capture:', e)
        return { error: 'Failed to capture Stripe payment', status: 502 }
      }
    }
  }

  // Step 2: Wallet debit audit row (idempotent — skip if already inserted).
  if (payment.wallet_units_provisioned && payment.wallet_units_provisioned > 0) {
    const { data: existingDebit } = await db
      .from('wallet_transactions')
      .select('id')
      .eq('note', `capture:${orderId}`)
      .eq('type', 'debit')
      .maybeSingle()

    if (!existingDebit) {
      const { data: provisionTx } = await db
        .from('wallet_transactions')
        .select('wallet_id')
        .eq('note', `order:${orderId}`)
        .eq('type', 'provision')
        .maybeSingle()

      if (provisionTx?.wallet_id) {
        const { error: txError } = await db.from('wallet_transactions').insert({
          wallet_id: provisionTx.wallet_id,
          type: 'debit',
          amount: payment.wallet_units_provisioned,
          note: `capture:${orderId}`,
          ...(cashierId ? { cashier_id: cashierId } : {}),
        })

        if (txError) {
          console.error('[captureOrder] wallet debit insert:', txError)
          return { error: 'Failed to record wallet debit', status: 500 }
        }
      }
    }
  }

  // Step 3: Finalise DB state.
  await db
    .from('payments')
    .update({
      status: 'captured',
      captured_at: new Date().toISOString(),
      wallet_units_captured: payment.wallet_units_provisioned,
    })
    .eq('id', payment.id)

  await db.from('orders').update({ status: 'completed' }).eq('id', orderId)

  return { ok: true }
}
