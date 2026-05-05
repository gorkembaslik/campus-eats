import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { cancelOrder } from '@/lib/orders/cancel'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST /api/webhooks/stripe
// Stripe sends events here after PaymentIntent state changes.
// Raw body must be used for signature verification — do NOT call req.json() first.
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (e) {
    console.error('[webhook] signature verification failed:', e)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createAdminClient()
  const intent = event.data.object as Stripe.PaymentIntent
  const orderId = intent.metadata?.order_id

  if (!orderId) {
    // Not one of our intents (e.g. a test event without metadata) — acknowledge and skip.
    return NextResponse.json({ received: true })
  }

  try {
    switch (event.type) {
      // Card payment confirmed by customer (3DS completed or non-3DS card authorized).
      // Intent is in requires_capture. Move order from awaiting_payment → pending so the
      // cashier queue picks it up, and mark the payment as authorized.
      case 'payment_intent.amount_capturable_updated': {
        const { data: order } = await db
          .from('orders')
          .select('id, status')
          .eq('id', orderId)
          .maybeSingle()

        if (order && order.status === 'awaiting_payment') {
          await db.from('orders').update({ status: 'pending' }).eq('id', orderId)
        }

        const { data: payment } = await db
          .from('payments')
          .select('id, status')
          .eq('order_id', orderId)
          .maybeSingle()

        if (payment && payment.status === 'pending') {
          await db.from('payments').update({ status: 'authorized' }).eq('id', payment.id)
        }
        break
      }

      // Intent cancelled (e.g. customer closed tab during 3DS, or auto-expiry).
      case 'payment_intent.canceled': {
        const { data: order } = await db
          .from('orders')
          .select('id, status')
          .eq('id', orderId)
          .maybeSingle()

        if (order && order.status !== 'cancelled' && order.status !== 'completed') {
          await cancelOrder(db, stripe, orderId)
        }
        break
      }

      // Payment failed (e.g. card declined after 3DS).
      case 'payment_intent.payment_failed': {
        const { data: order } = await db
          .from('orders')
          .select('id, status')
          .eq('id', orderId)
          .maybeSingle()

        if (order && order.status !== 'cancelled' && order.status !== 'completed') {
          // Mark payment failed before cancelling so the audit log is accurate.
          const { data: payment } = await db
            .from('payments')
            .select('id')
            .eq('order_id', orderId)
            .maybeSingle()

          if (payment) {
            await db.from('payments').update({ status: 'failed' }).eq('id', payment.id)
          }

          // Release wallet + cancel the order (Stripe intent is already failed, cancel call will no-op).
          await cancelOrder(db, stripe, orderId)
        }
        break
      }

      // PaymentIntent captured and succeeded — reconcile DB state in case the cashier /confirm
      // route had an intermittent failure or the webhook fires first.
      case 'payment_intent.succeeded': {
        const { data: payment } = await db
          .from('payments')
          .select('id, status')
          .eq('order_id', orderId)
          .maybeSingle()

        if (payment && payment.status !== 'captured') {
          await db
            .from('payments')
            .update({ status: 'captured', captured_at: new Date().toISOString() })
            .eq('id', payment.id)

          await db.from('orders').update({ status: 'completed' }).eq('id', orderId)
        }
        break
      }

      default:
        break
    }
  } catch (e) {
    console.error(`[webhook] handler error for ${event.type}:`, e)
    // Return 500 so Stripe retries the event.
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
