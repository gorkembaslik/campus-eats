import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { cancelOrder } from '@/lib/orders/cancel'
import { captureOrder } from '@/lib/orders/capture'

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const PENDING_TIMEOUT_MS  = 5  * 60 * 1000   // 5 min  → cancel  (refund)
const READY_TIMEOUT_MS    = 15 * 60 * 1000   // 15 min → complete (charge kept)

// POST /api/internal/auto-resolve
// Called by pg_cron every minute. Requires: Authorization: Bearer <CRON_SECRET>
// - Stale pending orders  (> 5 min)  → cancelled + full refund
// - Stale ready orders    (> 15 min) → completed  + payment captured
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db     = createAdminClient()
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const now    = new Date()

  const [pendingRes, readyRes] = await Promise.all([
    db
      .from('orders')
      .select('id')
      .in('status', ['awaiting_payment', 'pending'])
      .lt('created_at', new Date(now.getTime() - PENDING_TIMEOUT_MS).toISOString()),
    db
      .from('orders')
      .select('id')
      .eq('status', 'ready')
      .lt('updated_at', new Date(now.getTime() - READY_TIMEOUT_MS).toISOString()),
  ])

  const stalePending = pendingRes.data ?? []
  const staleReady   = readyRes.data   ?? []

  const cancelResults  = await Promise.allSettled(stalePending.map((o) => cancelOrder(db, stripe, o.id)))
  const captureResults = await Promise.allSettled(staleReady.map((o) => captureOrder(db, stripe, o.id)))

  // Log any failures for debugging; don't surface them as HTTP errors
  cancelResults.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[auto-resolve] cancel failed for order ${stalePending[i].id}:`, r.reason)
    }
  })
  captureResults.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[auto-resolve] capture failed for order ${staleReady[i].id}:`, r.reason)
    }
  })

  return NextResponse.json({
    cancelled: stalePending.length,
    completed: staleReady.length,
  })
}
