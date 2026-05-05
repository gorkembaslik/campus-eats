'use client'

import { useState, useEffect } from 'react'
import { CreditCard, ArrowRight, LogIn, Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useCartStore, type CartItem } from '@/store/cartStore'
import type { PaymentMethod } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WalletRow {
  balance: number
  restaurants: { ticket_eur_value: number | null } | null
}

export interface Props {
  totalEur: number
  nTickets: number      // ticket units needed for ticket-eligible items
  cardOnlyEur: number   // EUR for items with price_wallet_units = 0
  items: CartItem[]     // for accurate greedy split preview
  onConfirm: (method: PaymentMethod) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentSelector({ totalEur, nTickets, cardOnlyEur, items, onConfirm }: Props) {
  const { user, loading: userLoading } = useUser()
  const restaurantId = useCartStore((s) => s.restaurantId)

  const [ticketBal, setTicketBal] = useState(0)
  const [ticketVal, setTicketVal] = useState(0)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [useWallet, setUseWallet] = useState(false)

  useEffect(() => {
    if (userLoading) return
    if (!user || !restaurantId) { setFetchLoading(false); return }

    const supabase = createClient()
    const userId = user.id
    const restId = restaurantId

    async function load() {
      const { data: wallet } = await supabase
        .from('wallet_accounts')
        .select('balance, restaurants(ticket_eur_value)')
        .eq('user_id', userId)
        .eq('restaurant_id', restId)
        .maybeSingle<WalletRow>()

      if (wallet) {
        setTicketBal(wallet.balance)
        setTicketVal(wallet.restaurants?.ticket_eur_value ?? 0)
      } else {
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('ticket_eur_value')
          .eq('id', restId)
          .single()
        setTicketVal(restaurant?.ticket_eur_value ?? 0)
        setTicketBal(0)
      }
      setFetchLoading(false)
    }

    load()
  }, [userLoading, user, restaurantId])

  // Default checkbox to on if there's usable balance
  useEffect(() => {
    if (!fetchLoading) {
      setUseWallet(ticketBal > 0 && nTickets > 0)
    }
  }, [fetchLoading, ticketBal, nTickets])

  const loading = userLoading || fetchLoading

  if (loading) return <Skeleton />

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <LogIn className="w-8 h-8 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">Log in to place an order</p>
      </div>
    )
  }

  // ── Resolve payment method ────────────────────────────────────────────────
  const hasBalance    = ticketBal > 0
  const hasTicketItems = nTickets > 0
  const walletCoversAll = ticketBal >= nTickets

  const method: PaymentMethod =
    useWallet && hasBalance && hasTicketItems
      ? walletCoversAll ? 'wallet' : 'mixed'
      : 'stripe'

  // ── Breakdown preview ─────────────────────────────────────────────────────
  const { mixedTickets, mixedCard } = computeMixedSplit(items, ticketBal)

  return (
    <div className="px-4 py-5 flex flex-col gap-5">

      {/* Order total */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-2)]">Order total</span>
        <span className="text-lg font-bold text-[var(--text-1)]">€{totalEur.toFixed(2)}</span>
      </div>

      {/* Single payment card */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">

        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-white">
          <CreditCard className="w-5 h-5 text-[var(--text-3)] flex-shrink-0" />
          <span className="text-sm font-semibold text-[var(--text-1)]">Pay with Card</span>
        </div>

        {/* Wallet checkbox — only if there's balance and ticket-eligible items */}
        {hasBalance && hasTicketItems && (
          <label className="flex items-start gap-3 px-4 py-3.5 bg-[var(--surface-2)] border-t border-[var(--border)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useWallet}
              onChange={(e) => setUseWallet(e.target.checked)}
              className="mt-0.5 w-4 h-4 cursor-pointer accent-[var(--red)] flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-1)]">Use wallet balance</p>
              <p className="text-xs text-[var(--text-3)] mt-0.5 flex items-center gap-1 flex-wrap">
                {ticketBal.toFixed(2)} <Ticket className="w-3 h-3" /> available
                {ticketVal > 0 && (
                  <span className="opacity-70"> · ≈ €{(ticketBal * ticketVal).toFixed(2)}</span>
                )}
              </p>
            </div>
          </label>
        )}

        {/* Charge breakdown */}
        <div className="px-4 py-3 border-t border-[var(--border)] bg-white">
          <BreakdownLine method={method} nTickets={nTickets} cardOnlyEur={cardOnlyEur} mixedTickets={mixedTickets} mixedCard={mixedCard} ticketVal={ticketVal} />
        </div>
      </div>

      {/* Confirm */}
      <button
        onClick={() => onConfirm(method)}
        className="w-full flex items-center justify-center gap-2 bg-[var(--red)] hover:bg-[var(--red-dark)] active:bg-[var(--red-dark)] text-white font-semibold text-sm rounded-xl py-3 transition-colors"
      >
        Confirm Order
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function BreakdownLine({ method, nTickets, cardOnlyEur, mixedTickets, mixedCard, ticketVal }: {
  method: PaymentMethod
  nTickets: number
  cardOnlyEur: number
  mixedTickets: number
  mixedCard: number
  ticketVal: number
}) {
  const t = <Ticket className="w-3 h-3 inline-block mx-0.5 align-[-1px]" />
  const approx = (units: number) =>
    ticketVal > 0 ? ` (≈ €${(units * ticketVal).toFixed(2)})` : ''

  if (method === 'stripe') {
    return <p className="text-xs text-[var(--text-3)] leading-relaxed">Full amount held by Stripe — only charged when you collect your order.</p>
  }

  if (method === 'wallet') {
    return (
      <p className="text-xs text-[var(--text-3)] leading-relaxed">
        {nTickets.toFixed(2)}{t}{approx(nTickets)} from wallet
        {cardOnlyEur > 0
          ? ` · €${cardOnlyEur.toFixed(2)} via card for non-ticket items.`
          : ' · no card charge.'}
      </p>
    )
  }

  // mixed
  return (
    <p className="text-xs text-[var(--text-3)] leading-relaxed">
      {mixedTickets.toFixed(2)}{t}{approx(mixedTickets)} from wallet + €{mixedCard.toFixed(2)} via card.
    </p>
  )
}

function computeMixedSplit(
  items: CartItem[],
  balance: number,
): { mixedTickets: number; mixedCard: number } {
  const units = items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({
      ticketPrice: item.unitPriceWalletUnits,
      eurPrice: item.unitPriceEur,
    }))
  )
  units.sort((a, b) => a.ticketPrice - b.ticketPrice)

  let heldTickets = 0
  let cardEur = 0
  for (const unit of units) {
    if (unit.ticketPrice > 0 && heldTickets + unit.ticketPrice <= balance) {
      heldTickets += unit.ticketPrice
    } else {
      cardEur += unit.eurPrice
    }
  }
  return {
    mixedTickets: parseFloat(heldTickets.toFixed(2)),
    mixedCard: parseFloat(cardEur.toFixed(2)),
  }
}

function Skeleton() {
  return (
    <div className="px-4 py-5 space-y-5 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 w-20 bg-gray-200 rounded" />
        <div className="h-4 w-16 bg-gray-200 rounded" />
      </div>
      <div className="rounded-xl border border-gray-100 overflow-hidden space-y-px">
        <div className="h-12 bg-gray-100" />
        <div className="h-16 bg-gray-50" />
        <div className="h-10 bg-gray-100" />
      </div>
      <div className="h-11 bg-gray-200 rounded-xl" />
    </div>
  )
}
