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

function addDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function cleanNote(note: string | null): string | null {
  if (!note) return null
  return note.replace(/^idem:[0-9a-f-]{36}\s*\|\s*/i, '').trim() || null
}

const PAGE_SIZE = 50

// GET /api/admin/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&restaurantId=&cashierId=&page=1
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

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const defaultFrom = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10)
  const defaultTo = now.toISOString().slice(0, 10)

  const from = searchParams.get('from') || defaultFrom
  const to = searchParams.get('to') || defaultTo
  const restaurantId = searchParams.get('restaurantId') || null
  const cashierId = searchParams.get('cashierId') || null
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const offset = (page - 1) * PAGE_SIZE

  let q = db
    .from('wallet_transactions')
    .select(
      `id, amount, ticket_code, note, created_at,
       cashier:users!wallet_transactions_cashier_id_fkey ( id, full_name ),
       wallet:wallet_accounts!inner (
         user:users!wallet_accounts_user_id_fkey ( id, full_name, email ),
         restaurant:restaurants!inner ( id, name, currency_label )
       )`,
      { count: 'exact' }
    )
    .eq('type', 'credit')
    .gte('created_at', `${from}T00:00:00.000Z`)
    .lt('created_at', `${addDay(to)}T00:00:00.000Z`)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (cashierId) q = q.eq('cashier_id', cashierId)

  const { data, count, error } = await q

  if (error) {
    console.error('[audit] query:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Strip idempotency prefix from notes, apply restaurant filter client-side
  // (PostgREST nested filter on joined table requires !inner which we have for restaurant)
  let rows = (data ?? []).map((row) => ({
    ...row,
    note: cleanNote(row.note),
  }))

  if (restaurantId) {
    rows = rows.filter((r) => {
      const wallet = r.wallet as { restaurant?: { id?: string } } | null
      return wallet?.restaurant?.id === restaurantId
    })
  }

  return NextResponse.json({ rows, total: count ?? 0, page, pageSize: PAGE_SIZE })
}
