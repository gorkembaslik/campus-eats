import { notFound, redirect } from 'next/navigation'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { OrderStatusClient, type InitialOrder } from './OrderStatusClient'

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface Props {
  params: { orderId: string }
  searchParams: { redirect_status?: string }
}

export const dynamic = 'force-dynamic'

export default async function OrderPage({ params, searchParams }: Props) {
  const supabase = createServerClient()

  // Auth — redirect to login rather than showing a 404 to anonymous visitors.
  // getUser() validates the token with the Supabase Auth server (getSession() reads
  // cookies without verification and is insecure on the server).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/order/${params.orderId}`)
  }

  // Fetch order with all necessary joins in one round-trip.
  // RLS on `orders` enforces that customers can only read their own rows.
  // If the row doesn't exist or RLS blocks access, `.single()` returns null.
  const { data: order } = await supabase
    .from('orders')
    .select(
      `
      id,
      status,
      payment_method,
      created_at,
      user_id,
      restaurants ( name, currency_label, ticket_eur_value ),
      order_items (
        id,
        quantity,
        unit_price_eur,
        unit_price_wallet_units,
        menu_items ( name )
      ),
      payments (
        wallet_units_provisioned,
        stripe_amount_eur
      )
    `
    )
    .eq('id', params.orderId)
    .single()

  if (!order) notFound()

  // Belt-and-suspenders ownership check beyond RLS.
  // Cashiers and admins can view any order (for the staff dashboard).
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isStaff = profile?.role === 'cashier' || profile?.role === 'admin'
  if (order.user_id !== user.id && !isStaff) {
    redirect('/unauthorized')
  }

  // 3DS redirect: customer lands here after completing bank challenge.
  // Run the same authorize logic the StripeCheckout does for non-3DS payments.
  if (
    searchParams.redirect_status === 'succeeded' &&
    order.status === 'awaiting_payment' &&
    order.user_id === user.id
  ) {
    const db = createAdminClient()
    const { data: payment } = await db
      .from('payments')
      .select('id, stripe_payment_intent_id')
      .eq('order_id', params.orderId)
      .maybeSingle()

    if (payment?.stripe_payment_intent_id) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
        const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id)
        if (intent.status === 'requires_capture' || intent.status === 'succeeded') {
          await Promise.all([
            db.from('orders').update({ status: 'pending' }).eq('id', params.orderId),
            db.from('payments').update({ status: 'authorized' }).eq('id', payment.id),
          ])
          // Re-fetch the updated order so OrderStatusClient renders 'pending' immediately
          const { data: refreshed } = await supabase
            .from('orders')
            .select(`id, status, payment_method, created_at, user_id,
              restaurants ( name, currency_label, ticket_eur_value ),
              order_items ( id, quantity, unit_price_eur, unit_price_wallet_units, menu_items ( name ) ),
              payments ( wallet_units_provisioned, stripe_amount_eur )`)
            .eq('id', params.orderId)
            .single()
          if (refreshed) {
            return (
              <OrderStatusClient
                initialOrder={refreshed as unknown as InitialOrder}
                stripeRedirectStatus={searchParams.redirect_status}
                canCancel={refreshed.user_id === user.id && refreshed.status === 'pending'}
              />
            )
          }
        }
      } catch {
        // Non-fatal: order stays awaiting_payment, webhook will resolve it
      }
    }
  }

  return (
    <OrderStatusClient
      initialOrder={order as unknown as InitialOrder}
      stripeRedirectStatus={searchParams.redirect_status}
      canCancel={order.user_id === user.id && order.status === 'pending'}
    />
  )
}
