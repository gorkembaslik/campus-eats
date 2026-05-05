import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Stripe from 'stripe'

// ── Stripe singleton (initialised once per cold start) ───────────────────────

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// ── Types ────────────────────────────────────────────────────────────────────

type PaymentMethod = 'wallet' | 'stripe' | 'mixed'

interface RequestItem {
  menuItemId: string
  quantity: number
}

interface ParsedBody {
  restaurantId: string
  items: RequestItem[]
  paymentMethod: PaymentMethod
}

interface DbMenuItem {
  id: string
  price_eur: number
  price_wallet_units: number
}

function getEffectiveTicketCost(
  priceWalletUnits: number,
  priceEur: number,
  ticketEurValue: number
): number {
  return priceWalletUnits > 0 ? priceWalletUnits : ticketEurValue > 0 ? priceEur / ticketEurValue : 0
}

// Tracks what succeeded so rollback knows what to undo
interface RollbackState {
  orderId: string | null
  walletTxId: string | null
  ticketsHeld: boolean        // whether the wallet balance was actually deducted
  ticketAccId: string | null
  ticketsHeldAmt: number      // in ticket units
}

// ── Client factories ─────────────────────────────────────────────────────────

function createUserClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
}

// Service-role client: bypasses RLS — only used inside API routes
function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Validation ───────────────────────────────────────────────────────────────

function parseBody(raw: unknown): { ok: true; body: ParsedBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid body' }
  const b = raw as Record<string, unknown>

  if (typeof b.restaurantId !== 'string' || !b.restaurantId)
    return { ok: false, error: 'restaurantId is required' }

  if (!Array.isArray(b.items) || b.items.length === 0)
    return { ok: false, error: 'items must be a non-empty array' }

  for (const item of b.items) {
    if (!item || typeof item !== 'object') return { ok: false, error: 'Invalid item shape' }
    const i = item as Record<string, unknown>
    if (typeof i.menuItemId !== 'string' || !i.menuItemId)
      return { ok: false, error: 'Each item requires menuItemId' }
    if (
      typeof i.quantity !== 'number' ||
      !Number.isInteger(i.quantity) ||
      i.quantity < 1
    )
      return { ok: false, error: 'Each item requires a positive integer quantity' }
  }

  const validMethods: PaymentMethod[] = ['wallet', 'stripe', 'mixed']
  if (!validMethods.includes(b.paymentMethod as PaymentMethod))
    return { ok: false, error: 'paymentMethod must be wallet | stripe | mixed' }

  return {
    ok: true,
    body: {
      restaurantId: b.restaurantId,
      items: b.items as RequestItem[],
      paymentMethod: b.paymentMethod as PaymentMethod,
    },
  }
}

// ── Rollback ─────────────────────────────────────────────────────────────────

async function rollback(
  db: ReturnType<typeof createAdminClient>,
  state: RollbackState
): Promise<void> {
  const { orderId, walletTxId, ticketsHeld, ticketAccId, ticketsHeldAmt } = state
  if (!orderId) return

  // Restore ticket balance before touching the transaction log
  if (ticketsHeld && ticketAccId && ticketsHeldAmt > 0) {
    const { data: current } = await db
      .from('wallet_accounts')
      .select('balance')
      .eq('id', ticketAccId)
      .single()

    if (current) {
      await db
        .from('wallet_accounts')
        .update({ balance: current.balance + ticketsHeldAmt })
        .eq('id', ticketAccId)
    }
  }

  if (walletTxId) {
    await db.from('wallet_transactions').delete().eq('id', walletTxId)
  }

  // Delete in reverse FK dependency order
  await db.from('payments').delete().eq('order_id', orderId)
  await db.from('order_items').delete().eq('order_id', orderId)
  await db.from('orders').delete().eq('id', orderId)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── POST /api/orders ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Authenticate ────────────────────────────────────────────────────────
  const userClient = createUserClient()
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  // ── 1b. Idempotency — short-circuit duplicate submissions ──────────────────
  const rawKey = req.headers.get('Idempotency-Key')
  const idempotencyKey = rawKey && UUID_RE.test(rawKey) ? rawKey : null

  if (idempotencyKey) {
    const { data: existing } = await db
      .from('orders')
      .select('id, payments(stripe_payment_intent_id)')
      .eq('idempotency_key', idempotencyKey)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      const intentId =
        (existing.payments as { stripe_payment_intent_id: string | null }[] | null)?.[0]
          ?.stripe_payment_intent_id ?? null

      let stripeClientSecret: string | null = null
      if (intentId) {
        try {
          const intent = await stripe.paymentIntents.retrieve(intentId)
          stripeClientSecret = intent.client_secret
        } catch (e) {
          console.error('[orders] idempotency retrieve intent:', e)
        }
      }

      return NextResponse.json(
        { orderId: existing.id, ...(stripeClientSecret ? { stripeClientSecret } : {}) },
        { status: 200 }
      )
    }
  }

  // ── 2. Validate request body ───────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseBody(rawBody)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { restaurantId, items, paymentMethod } = parsed.body

  // Cashiers cannot place orders
  const { data: profile } = await db
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role === 'cashier') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── 3. Fetch restaurant config + current DB prices ────────────────────────
  const menuItemIds = Array.from(new Set(items.map((i) => i.menuItemId)))

  const [{ data: restaurant, error: restaurantError }, { data: dbItems, error: menuError }] =
    await Promise.all([
      db
        .from('restaurants')
        .select('id, ticket_eur_value')
        .eq('id', restaurantId)
        .single(),
      db
        .from('menu_items')
        .select('id, price_eur, price_wallet_units')
        .in('id', menuItemIds)
        .eq('restaurant_id', restaurantId)
        .eq('available', true),
    ])

  if (restaurantError || !restaurant) {
    console.error('[orders] fetch restaurant:', restaurantError)
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 400 })
  }

  const ticketEurValue = (restaurant as { id: string; ticket_eur_value: number }).ticket_eur_value
  if (!ticketEurValue || ticketEurValue <= 0) {
    return NextResponse.json({ error: 'Restaurant ticket value not configured' }, { status: 400 })
  }

  if (menuError || !dbItems || dbItems.length !== menuItemIds.length) {
    console.error('[orders] fetch menu_items:', menuError)
    return NextResponse.json(
      { error: 'One or more items are unavailable or do not belong to this restaurant' },
      { status: 400 }
    )
  }

  const priceMap = new Map<string, DbMenuItem>(dbItems.map((m) => [m.id, m]))

  // ── 4. Compute totals from DB prices ───────────────────────────────────────
  let totalEur = 0
  let nTickets = 0  // total ticket units needed (all items are ticket-eligible)

  for (const item of items) {
    const p = priceMap.get(item.menuItemId)!
    totalEur += p.price_eur * item.quantity
    nTickets  += getEffectiveTicketCost(p.price_wallet_units, p.price_eur, ticketEurValue) * item.quantity
  }

  totalEur  = parseFloat(totalEur.toFixed(2))
  nTickets  = parseFloat(nTickets.toFixed(2))

  // ── 5. Ticket balance check ────────────────────────────────────────────────
  let ticketAcc: { id: string; balance: number } | null = null

  if (paymentMethod === 'wallet' || paymentMethod === 'mixed') {
    const { data: acc } = await db
      .from('wallet_accounts')
      .select('id, balance')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    ticketAcc = acc

    if (paymentMethod === 'wallet') {
      if (!ticketAcc || ticketAcc.balance < nTickets) {
        return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 402 })
      }
    }
  }

  // ── Compute split amounts — item-level greedy attribution ──────────────────
  // All items are ticket-eligible.
  // price_wallet_units > 0 → use that explicit ticket cost
  // price_wallet_units = 0 → convert: price_eur / ticketEurValue
  const ticketBal = ticketAcc?.balance ?? 0
  let ticketsProv = 0   // ticket units to provision from wallet
  let cardEur     = 0   // EUR to charge via Stripe

  // Per-line attribution for the order_items insert
  const itemAttribution = new Map<string, { walletQty: number; stripeQty: number }>()
  for (const item of items) {
    itemAttribution.set(item.menuItemId, { walletQty: 0, stripeQty: 0 })
  }

  if (paymentMethod === 'stripe') {
    cardEur = totalEur
    for (const item of items) {
      itemAttribution.set(item.menuItemId, { walletQty: 0, stripeQty: item.quantity })
    }
  } else if (paymentMethod === 'wallet') {
    for (const item of items) {
      const p = priceMap.get(item.menuItemId)!
      const ticketCost = getEffectiveTicketCost(p.price_wallet_units, p.price_eur, ticketEurValue)
      ticketsProv += ticketCost * item.quantity
      itemAttribution.set(item.menuItemId, { walletQty: item.quantity, stripeQty: 0 })
    }
    ticketsProv = parseFloat(ticketsProv.toFixed(2))
  } else {
    // mixed: greedy — expand to individual units, cheapest-ticket-price first
    const units = items.flatMap((item) => {
      const p = priceMap.get(item.menuItemId)!
      const ticketPrice = getEffectiveTicketCost(p.price_wallet_units, p.price_eur, ticketEurValue)
      return Array.from({ length: item.quantity }, () => ({
        menuItemId:  item.menuItemId,
        ticketPrice,
        eurPrice:    p.price_eur,
      }))
    })
    units.sort((a, b) => a.ticketPrice - b.ticketPrice)

    let heldTickets = 0
    for (const unit of units) {
      const attr = itemAttribution.get(unit.menuItemId)!
      if (unit.ticketPrice > 0 && heldTickets + unit.ticketPrice <= ticketBal) {
        heldTickets += unit.ticketPrice
        attr.walletQty += 1
      } else {
        cardEur += unit.eurPrice
        attr.stripeQty += 1
      }
    }

    ticketsProv = parseFloat(heldTickets.toFixed(2))
    cardEur     = parseFloat(cardEur.toFixed(2))
  }

  // Track rollback state as we proceed through each write
  const rb: RollbackState = {
    orderId:       null,
    walletTxId:    null,
    ticketsHeld:   false,
    ticketAccId:   ticketAcc?.id ?? null,
    ticketsHeldAmt: 0,
  }

  // ── 6. Create order ────────────────────────────────────────────────────────
  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      restaurant_id: restaurantId,
      user_id: user.id,
      // Wallet orders are paid immediately; card/mixed wait for Stripe webhook confirmation.
      status: paymentMethod === 'wallet' ? 'pending' : 'awaiting_payment',
      payment_method: paymentMethod,
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    })
    .select('id')
    .single()

  if (orderError || !order) {
    console.error('[orders] insert order:', orderError)
    return NextResponse.json({ error: orderError?.message ?? 'Failed to create order' }, { status: 500 })
  }

  rb.orderId = order.id

  // ── 7. Create order_items with price snapshots ─────────────────────────────
  const orderItemsPayload = items.map((item) => {
    const p = priceMap.get(item.menuItemId)!
    const attr = itemAttribution.get(item.menuItemId)!
    return {
      order_id: order.id,
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
      unit_price_eur: p.price_eur,
      unit_price_wallet_units: p.price_wallet_units,
      wallet_quantity: attr.walletQty,
      stripe_quantity: attr.stripeQty,
    }
  })

  const { error: itemsError } = await db.from('order_items').insert(orderItemsPayload)

  if (itemsError) {
    console.error('[orders] insert order_items:', itemsError)
    await rollback(db, rb)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // ── 8. Create payments row ─────────────────────────────────────────────────
  const { data: payment, error: paymentError } = await db
    .from('payments')
    .insert({
      order_id: order.id,
      // Wallet-only: balance deducted atomically above — payment is immediately secured.
      // Card/mixed: mark 'pending' until Stripe webhook confirms the intent.
      status: paymentMethod === 'wallet' ? 'authorized' : 'pending',
      wallet_units_provisioned: ticketsProv > 0 ? ticketsProv : null,
      stripe_amount_eur: cardEur > 0 ? cardEur : null,
    })
    .select('id')
    .single()

  if (paymentError || !payment) {
    console.error('[orders] insert payment:', paymentError)
    await rollback(db, rb)
    return NextResponse.json({ error: paymentError?.message ?? 'Failed to create payment' }, { status: 500 })
  }

  // ── 9. Ticket provision ────────────────────────────────────────────────────
  if (ticketsProv > 0) {
    const { data: tx, error: txError } = await db.from('wallet_transactions').insert({
      wallet_id: ticketAcc!.id,
      type: 'provision',
      amount: ticketsProv,
      note: `order:${order.id}`,
    }).select('id').single()

    if (txError || !tx) {
      console.error('[orders] insert wallet_transaction:', txError)
      await rollback(db, rb)
      return NextResponse.json({ error: txError?.message ?? 'Failed to record wallet transaction' }, { status: 500 })
    }

    rb.walletTxId = tx.id

    // Conditional deduction: only succeeds when balance is still sufficient.
    // The `.gte()` filter is the atomic guard against double-spend races.
    const { data: deducted, error: deductError } = await db
      .from('wallet_accounts')
      .update({ balance: ticketAcc!.balance - ticketsProv })
      .eq('id', ticketAcc!.id)
      .gte('balance', ticketsProv)
      .select('id')
      .maybeSingle()

    if (deductError || !deducted) {
      console.error('[orders] deduct ticket balance:', deductError)
      await rollback(db, rb)
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 402 })
    }

    rb.ticketsHeld    = true
    rb.ticketsHeldAmt = ticketsProv
  }

  // ── 10. Stripe PaymentIntent ───────────────────────────────────────────────
  let stripeClientSecret: string | null = null

  if (cardEur > 0) {
    const stripeAmountCents = Math.round(cardEur * 100)

    if (stripeAmountCents < 50) {
      await rollback(db, rb)
      return NextResponse.json(
        { error: 'Card amount is below the Stripe minimum (€0.50). Use wallet payment instead.' },
        { status: 400 }
      )
    }

    let intentId: string | undefined
    try {
      const intent = await stripe.paymentIntents.create({
        amount: stripeAmountCents,
        currency: 'eur',
        capture_method: 'manual',
        metadata: { order_id: order.id, user_id: user.id },
      })

      intentId = intent.id
      stripeClientSecret = intent.client_secret

      const { error: intentError } = await db
        .from('payments')
        .update({ stripe_payment_intent_id: intent.id })
        .eq('id', payment.id)

      if (intentError) throw intentError
    } catch (error) {
      console.error('[orders] stripe intent:', error)
      if (intentId) {
        await stripe.paymentIntents.cancel(intentId).catch(() => {})
      }
      await rollback(db, rb)
      return NextResponse.json({ error: 'Failed to create Stripe payment intent' }, { status: 500 })
    }
  }

  // ── 11. Return ─────────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      orderId: order.id,
      ...(stripeClientSecret ? { stripeClientSecret } : {}),
    },
    { status: 201 }
  )
}
