import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { OrderStatus } from '@/types'

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

const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending:   'preparing',
  preparing: 'ready',
}

// PATCH /api/cashier/orders/[orderId]/status
// Advances the order through the status flow: pending→preparing→ready.
// Capture (ready→completed) is handled by the /confirm endpoint.
export async function PATCH(
  req: NextRequest,
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

  let body: { status?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const newStatus = body.status as OrderStatus
  if (!['preparing', 'ready'].includes(newStatus)) {
    return NextResponse.json({ error: 'status must be "preparing" or "ready"' }, { status: 400 })
  }

  const { data: order } = await db
    .from('orders')
    .select('id, status')
    .eq('id', params.orderId)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (ALLOWED_TRANSITIONS[order.status as OrderStatus] !== newStatus) {
    return NextResponse.json(
      { error: `Cannot transition from "${order.status}" to "${newStatus}"` },
      { status: 409 }
    )
  }

  const { error: updateError } = await db
    .from('orders')
    .update({ status: newStatus })
    .eq('id', params.orderId)

  if (updateError) {
    console.error('[status] update order:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
