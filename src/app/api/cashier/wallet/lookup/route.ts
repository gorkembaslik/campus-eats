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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/cashier/wallet/lookup?userId=<uuid>&restaurantId=<uuid>
// Returns customer name + current balance at the given restaurant for the cashier to verify.
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

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const restaurantId = searchParams.get('restaurantId')

  if (!userId || !restaurantId || !UUID_RE.test(userId) || !UUID_RE.test(restaurantId)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const { data: customer } = await db
    .from('users')
    .select('id, full_name')
    .eq('id', userId)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const { data: wallet } = await db
    .from('wallet_accounts')
    .select('balance')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  return NextResponse.json({
    id: customer.id,
    full_name: customer.full_name,
    balance: Number(wallet?.balance ?? 0),
  })
}
