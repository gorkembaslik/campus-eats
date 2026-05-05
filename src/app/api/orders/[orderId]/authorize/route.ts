import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function createUserClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST /api/orders/[orderId]/authorize
// Called by StripeCheckout immediately after confirmPayment() returns requires_capture.
// Verifies the intent status directly with Stripe and moves orders.status → pending.
// This is the primary path; the Stripe webhook is the fallback.
export async function POST(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const userClient = createUserClient()
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const { orderId } = params

  const { data: order } = await db
    .from('orders')
    .select('id, user_id, status')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Already confirmed — idempotent
  if (order.status !== 'awaiting_payment') return NextResponse.json({ ok: true })

  const { data: payment } = await db
    .from('payments')
    .select('id, stripe_payment_intent_id')
    .eq('order_id', orderId)
    .maybeSingle()

  if (!payment?.stripe_payment_intent_id) {
    return NextResponse.json({ error: 'No Stripe intent on this order' }, { status: 400 })
  }

  // Verify directly with Stripe — don't trust the client-side status alone
  const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id)
  if (intent.status !== 'requires_capture' && intent.status !== 'succeeded') {
    return NextResponse.json({ error: 'Payment not yet confirmed' }, { status: 402 })
  }

  await Promise.all([
    db.from('orders').update({ status: 'pending' }).eq('id', orderId),
    db.from('payments').update({ status: 'authorized' }).eq('id', payment.id),
  ])

  return NextResponse.json({ ok: true })
}
