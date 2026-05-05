import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Stripe from 'stripe'
import { cancelOrder } from '@/lib/orders/cancel'

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

// DELETE /api/orders/[orderId]
// Customer cancel-on-back: only the order owner can call this, only for pending orders.
export async function DELETE(
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

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (order.status !== 'pending' && order.status !== 'awaiting_payment') {
    return NextResponse.json({ error: 'Only pending orders can be cancelled' }, { status: 409 })
  }

  await cancelOrder(db, stripe, orderId)

  return NextResponse.json({ ok: true })
}
