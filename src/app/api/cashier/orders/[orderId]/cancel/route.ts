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

// POST /api/cashier/orders/[orderId]/cancel
// Cashier cancel: works on any pending or preparing order regardless of user_id.
// Releases wallet provision, voids Stripe intent, marks order cancelled.
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

  const { data: profile } = await db
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || (profile.role !== 'cashier' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: order } = await db
    .from('orders')
    .select('id, status')
    .eq('id', params.orderId)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (!['pending', 'preparing'].includes(order.status)) {
    return NextResponse.json(
      { error: 'Only pending or preparing orders can be cancelled' },
      { status: 409 }
    )
  }

  await cancelOrder(db, stripe, params.orderId, user.id)

  return NextResponse.json({ ok: true })
}
