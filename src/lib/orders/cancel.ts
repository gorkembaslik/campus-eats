import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Shared cancel logic used by both the customer DELETE route and the cashier cancel endpoint.
// Voids the Stripe intent (best-effort), releases the wallet provision, and marks the order cancelled.
export async function cancelOrder(
  db: SupabaseClient,
  stripe: Stripe,
  orderId: string,
  cashierId?: string
): Promise<void> {
  const { data: payment } = await db
    .from('payments')
    .select('id, stripe_payment_intent_id, wallet_units_provisioned')
    .eq('order_id', orderId)
    .maybeSingle()

  // Void Stripe intent — best-effort, swallow errors (may already be in a terminal state)
  if (payment?.stripe_payment_intent_id) {
    try {
      await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id)
    } catch (e) {
      console.error('[cancelOrder] stripe cancel:', e)
    }
  }

  // Release wallet provision if any
  if (payment?.wallet_units_provisioned && payment.wallet_units_provisioned > 0) {
    const { data: provisionTx } = await db
      .from('wallet_transactions')
      .select('wallet_id')
      .eq('note', `order:${orderId}`)
      .eq('type', 'provision')
      .maybeSingle()

    if (provisionTx?.wallet_id) {
      const { data: acc } = await db
        .from('wallet_accounts')
        .select('balance')
        .eq('id', provisionTx.wallet_id)
        .single()

      if (acc) {
        await db
          .from('wallet_accounts')
          .update({ balance: acc.balance + payment.wallet_units_provisioned })
          .eq('id', provisionTx.wallet_id)

        await db.from('wallet_transactions').insert({
          wallet_id: provisionTx.wallet_id,
          type: 'release',
          amount: payment.wallet_units_provisioned,
          note: `order:${orderId}`,
          ...(cashierId ? { cashier_id: cashierId } : {}),
        })
      }
    }
  }

  await db.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
}
