import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

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

const ORDER_SELECT = `
  id,
  status,
  payment_method,
  created_at,
  restaurant_id,
  user_id,
  users ( full_name ),
  order_items (
    id,
    quantity,
    unit_price_eur,
    unit_price_wallet_units,
    menu_items ( name )
  ),
  payments (
    stripe_payment_intent_id,
    wallet_units_provisioned,
    stripe_amount_eur,
    status
  )
` as const

// GET /api/cashier/orders?restaurantId=<uuid>
// Returns { active: CashierOrder[], history: CashierOrder[] } for today.
// Requires cashier or admin role.
export async function GET(req: NextRequest) {
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

  const restaurantId = req.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [activeRes, historyRes] = await Promise.all([
    db
      .from('orders')
      .select(ORDER_SELECT)
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true }),
    db
      .from('orders')
      .select(ORDER_SELECT)
      .eq('restaurant_id', restaurantId)
      .in('status', ['completed', 'cancelled'])
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    active: activeRes.data ?? [],
    history: historyRes.data ?? [],
  })
}
