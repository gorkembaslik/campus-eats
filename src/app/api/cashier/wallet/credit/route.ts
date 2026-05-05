import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { DenominationMap } from '@/types'

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

// POST /api/cashier/wallet/credit
// Credits ticket denominations to a customer's wallet. Idempotent via Idempotency-Key header.
export async function POST(req: NextRequest) {
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

  // Idempotency check — if we already processed this key, return the original result
  const idemKey = req.headers.get('Idempotency-Key')
  if (idemKey) {
    const { data: prior } = await db
      .from('wallet_transactions')
      .select('wallet_id, amount')
      .like('note', `idem:${idemKey}%`)
      .eq('type', 'credit')

    if (prior && prior.length > 0) {
      const totalPrior = prior.reduce((s, r) => s + Number(r.amount), 0)
      const { data: acc } = await db
        .from('wallet_accounts')
        .select('balance')
        .eq('id', prior[0].wallet_id)
        .single()
      return NextResponse.json({
        ok: true,
        idempotent: true,
        totalCredited: totalPrior,
        newBalance: Number(acc?.balance ?? 0),
      })
    }
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { userId, restaurantId, items, note } = body

  if (!userId || !restaurantId || !UUID_RE.test(userId) || !UUID_RE.test(restaurantId)) {
    return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Empty basket' }, { status: 400 })
  }

  // Validate denominations against the restaurant's config
  const { data: restaurant } = await db
    .from('restaurants')
    .select('id, is_active, ticket_denominations')
    .eq('id', restaurantId)
    .maybeSingle()

  if (!restaurant?.is_active) {
    return NextResponse.json({ error: 'Restaurant not found or inactive' }, { status: 404 })
  }

  const denoms = (restaurant.ticket_denominations ?? {}) as DenominationMap
  let total = 0

  for (const it of items) {
    if (
      typeof it?.code !== 'string' ||
      typeof it.quantity !== 'number' ||
      !Number.isInteger(it.quantity) ||
      it.quantity < 1 ||
      it.quantity > 100
    ) {
      return NextResponse.json({ error: 'Invalid item' }, { status: 400 })
    }
    const value = denoms[it.code]
    if (typeof value !== 'number' || value <= 0) {
      return NextResponse.json({ error: `Unknown denomination: ${it.code}` }, { status: 400 })
    }
    total = Math.round((total + value * it.quantity) * 100) / 100
  }

  // Verify customer exists
  const { data: customer } = await db
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Upsert wallet account (create if first visit to this restaurant)
  let { data: wallet } = await db
    .from('wallet_accounts')
    .select('id, balance')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!wallet) {
    const { data: created, error: createErr } = await db
      .from('wallet_accounts')
      .insert({ user_id: userId, restaurant_id: restaurantId, balance: 0 })
      .select('id, balance')
      .single()

    if (createErr || !created) {
      console.error('[credit] wallet create:', createErr)
      return NextResponse.json({ error: 'Could not create wallet' }, { status: 500 })
    }
    wallet = created
  }

  // Build one transaction row per ticket instance for a complete audit trail
  const effectiveKey = idemKey ?? crypto.randomUUID()
  const noteValue = `idem:${effectiveKey}${note?.trim() ? ` | ${note.trim()}` : ''}`

  const rows = items.flatMap((it: { code: string; quantity: number }) =>
    Array.from({ length: it.quantity }, () => ({
      wallet_id: wallet!.id,
      cashier_id: user.id,
      type: 'credit' as const,
      amount: denoms[it.code],
      ticket_code: it.code,
      note: noteValue,
    }))
  )

  const { error: txErr } = await db.from('wallet_transactions').insert(rows)
  if (txErr) {
    console.error('[credit] tx insert:', txErr)
    return NextResponse.json({ error: 'Failed to record transactions' }, { status: 500 })
  }

  // Atomically increment balance via SQL function (prevents lost-update races)
  const { data: newBal, error: rpcErr } = await db.rpc('credit_wallet', {
    p_wallet_id: wallet.id,
    p_amount: total,
  })

  if (rpcErr || newBal == null) {
    console.error('[credit] rpc:', rpcErr)
    return NextResponse.json(
      { error: 'Transactions recorded but balance update failed — contact admin' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, totalCredited: total, newBalance: Number(newBal) })
}
