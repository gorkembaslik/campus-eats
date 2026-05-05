'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import {
  X,
  Plus,
  Minus,
  ShoppingCart,
  ChevronLeft,
  Lock,
  Loader2,
  Ticket,
} from 'lucide-react'
import {
  useCartStore,
  selectTotalEur,
  selectNTickets,
  selectMenuUrl,
  type CartItem,
} from '@/store/cartStore'
import type { PaymentMethod } from '@/types'
import { PaymentSelector } from '@/components/cart/PaymentSelector'
import { StripeCheckout } from '@/components/cart/StripeCheckout'

// ── Types ─────────────────────────────────────────────────────────────────────

type View = 'cart' | 'payment-selector' | 'submitting' | 'stripe-checkout'

interface StripeData {
  clientSecret: string
  orderId: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  currentRestaurantId: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CartSidebar({ isOpen, onClose, currentRestaurantId }: Props) {
  const router = useRouter()
  const [view, setView] = useState<View>('cart')
  const [stripeData, setStripeData] = useState<StripeData | null>(null)
  const [ticketEurValue, setTicketEurValue] = useState(0)
  // Stable per checkout attempt; regenerated each time the user enters payment-selector
  const idempotencyKeyRef = useRef<string | null>(null)

  const items = useCartStore((s) => s.items)
  const restaurantId = useCartStore((s) => s.restaurantId)
  const restaurantSlug = useCartStore((s) => s.restaurantSlug)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const setPaymentMethod = useCartStore((s) => s.setPaymentMethod)
  const clearCart = useCartStore((s) => s.clearCart)

  const menuUrl = selectMenuUrl(restaurantSlug)

  // Reset local state whenever the cart becomes empty (after order success or manual clear)
  useEffect(() => {
    if (items.length === 0) {
      setView('cart')
      setStripeData(null)
      idempotencyKeyRef.current = null
    }
  }, [items.length])

  useEffect(() => {
    if (!restaurantId) { setTicketEurValue(0); return }
    const supabase = createClient()
    supabase
      .from('restaurants')
      .select('ticket_eur_value')
      .eq('id', restaurantId)
      .single()
      .then(({ data }) => {
        setTicketEurValue(data?.ticket_eur_value ?? 0)
      })
  }, [restaurantId])

  const totalEur    = selectTotalEur(items)
  const nTickets    = selectNTickets(items)
  const isEmpty     = items.length === 0 || restaurantId !== currentRestaurantId

  // EUR for items that can never be paid with tickets (price_wallet_units = 0)
  const cardOnlyEur = parseFloat(
    items
      .filter((i) => i.unitPriceWalletUnits === 0)
      .reduce((sum, i) => sum + i.unitPriceEur * i.quantity, 0)
      .toFixed(2)
  )

  const ticketEurEquiv      = ticketEurValue > 0 ? nTickets * ticketEurValue : 0
  const showTicketBreakdown = nTickets > 0 && ticketEurValue > 0

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleClose() {
    if (view === 'submitting') return
    setView('cart')
    onClose()
  }

  async function handleCancelAndBack() {
    if (!stripeData) return
    try {
      await fetch(`/api/orders/${stripeData.orderId}`, { method: 'DELETE' })
    } catch {
      // Best-effort; proceed regardless so the user is never stuck
    }
    idempotencyKeyRef.current = null
    setStripeData(null)
    setView('payment-selector')
  }

  async function handleConfirmOrder(method: PaymentMethod) {
    if (isEmpty || !restaurantId) return

    setPaymentMethod(method)
    setView('submitting')

    let res: Response
    try {
      res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idempotencyKeyRef.current ? { 'Idempotency-Key': idempotencyKeyRef.current } : {}),
        },
        body: JSON.stringify({
          restaurantId,
          items: items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
          paymentMethod: method,
        }),
      })
    } catch {
      toast.error('Network error — please try again.')
      setView('payment-selector')
      return
    }

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'Failed to place order')
      setView('payment-selector')
      return
    }

    if (data.stripeClientSecret) {
      setStripeData({ clientSecret: data.stripeClientSecret, orderId: data.orderId })
      setView('stripe-checkout')
    } else {
      clearCart()  // triggers the useEffect above, resetting view + stripeData
      router.push(`/order/${data.orderId}`)
    }
  }

  function handleStripeSuccess(orderId: string) {
    clearCart()  // triggers the useEffect above, resetting view + stripeData
    router.push(`/order/${orderId}`)
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  const stripeFullscreen = view === 'stripe-checkout' && stripeData

  return (
    <>
      {/* Backdrop — mobile only */}
      {isOpen && (
        <div
          className="fixed top-16 inset-x-0 bottom-0 bg-black/40 z-30 md:hidden"
          aria-hidden
          onClick={handleClose}
        />
      )}

      <aside
        className={[
          'fixed top-16 right-0 z-40',
          'transition-transform duration-300 ease-in-out',
          'w-full max-w-sm h-[calc(100vh-4rem)] shadow-2xl',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          'md:w-[380px] md:max-w-none md:shadow-none',
          isEmpty
            ? 'md:translate-x-full md:pointer-events-none'
            : 'md:translate-x-0',
        ].join(' ')}
        aria-label="Shopping cart"
      >
        <div className="flex flex-col h-full bg-white md:border-l md:border-[var(--border)]">
          {stripeFullscreen ? (
            <StripeCheckout
              clientSecret={stripeData.clientSecret}
              orderId={stripeData.orderId}
              onBack={handleCancelAndBack}
              onSuccess={handleStripeSuccess}
            />
          ) : (
            <>
              {/* ── Header ── */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5 min-w-0">
                  {view === 'payment-selector' ? (
                    <button
                      onClick={() => { idempotencyKeyRef.current = null; setView('cart') }}
                      className="flex items-center gap-1 text-sm font-medium text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                  ) : view === 'submitting' ? (
                    <p className="text-sm font-medium text-[var(--text-3)]">
                      Placing order…
                    </p>
                  ) : (
                    <>
                      {menuUrl && (
                        <button
                          onClick={() => { router.push(menuUrl); onClose() }}
                          className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors flex-shrink-0"
                          aria-label="Back to menu"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      )}
                      <h2 className="text-base font-bold text-[var(--text-1)]">
                        Your Order
                      </h2>
                      {!isEmpty && (
                        <span className="text-xs font-semibold bg-[var(--red-light)] text-[var(--red)] rounded-full px-2 py-0.5 flex-shrink-0">
                          {items.reduce((n, i) => n + i.quantity, 0)}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Close — mobile only */}
                <button
                  onClick={handleClose}
                  disabled={view === 'submitting'}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40 md:hidden flex-shrink-0"
                  aria-label="Close cart"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── Body ── */}
              <div className="flex-1 overflow-y-auto">
                {view === 'submitting' ? (
                  <PlacingOrderLoader />
                ) : view === 'payment-selector' ? (
                  <PaymentSelector
                    totalEur={totalEur}
                    nTickets={nTickets}
                    cardOnlyEur={cardOnlyEur}
                    items={items}
                    onConfirm={handleConfirmOrder}
                  />
                ) : isEmpty ? (
                  <EmptyState menuUrl={menuUrl} />
                ) : (
                  <ItemList
                    items={items}
                    onUpdateQuantity={updateQuantity}
                  />
                )}
              </div>

              {/* ── Footer ── */}
              {!isEmpty && view === 'cart' && (
                <div className="flex-shrink-0">
                  {/* Divider */}
                  <div className="h-px bg-[var(--border)]" />

                  <div className="px-5 py-5 space-y-5">
                    {/* Totals breakdown */}
                    <div className="space-y-2.5">
                      {/* Subtotal */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--text-2)]">Subtotal</span>
                        <span className="font-semibold text-[var(--text-1)]">
                          €{totalEur.toFixed(2)}
                        </span>
                      </div>

                      {/* Ticket portion */}
                      {showTicketBreakdown && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1" style={{ color: 'var(--success)' }}>
                            <Ticket className="w-3.5 h-3.5" />
                          </span>
                          <span className="font-semibold flex items-center gap-1" style={{ color: 'var(--success)' }}>
                            −{nTickets.toFixed(2)} <Ticket className="w-3.5 h-3.5" />{' '}
                            <span className="font-normal opacity-75">
                              (≈ −€{ticketEurEquiv.toFixed(2)})
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Card-only portion */}
                      {cardOnlyEur > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--text-2)]">Card-only items</span>
                          <span className="font-semibold text-[var(--text-1)]">
                            €{cardOnlyEur.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Place Order button */}
                    <button
                      onClick={() => {
                        idempotencyKeyRef.current = crypto.randomUUID()
                        setView('payment-selector')
                      }}
                      className="w-full flex items-center justify-center gap-2.5 bg-[var(--red)] hover:bg-[var(--red-dark)] active:bg-[var(--red-dark)] text-white font-bold text-sm rounded-xl py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--red)] focus-visible:ring-offset-2"
                    >
                      <Lock className="w-4 h-4" />
                      Place Order
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlacingOrderLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center px-6">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--red)' }} />
      <p className="text-sm font-medium text-[var(--text-3)]">Placing your order…</p>
    </div>
  )
}

function EmptyState({ menuUrl }: { menuUrl: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 py-16">
      <div className="w-14 h-14 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center">
        <ShoppingCart className="w-7 h-7 text-[var(--text-3)]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--text-1)]">Your cart is empty</p>
        <p className="text-xs text-[var(--text-3)] mt-1">Add items to get started</p>
      </div>
      {menuUrl && (
        <Link
          href={menuUrl}
          className="mt-1 text-xs font-semibold text-[var(--red)] hover:underline transition-colors"
        >
          Browse the menu →
        </Link>
      )}
    </div>
  )
}

function ItemList({
  items,
  onUpdateQuantity,
}: {
  items: CartItem[]
  onUpdateQuantity: (id: string, qty: number) => void
}) {
  return (
    <ul className="divide-y divide-[var(--border)]">
      {items.map((item) => (
        <li key={item.menuItemId} className="flex items-center gap-3 px-5 py-4">
          {/*
            Grey pill − N + control.
            Always fully expanded in the cart (qty ≥ 1).
            Decrementing to 0 removes the item via updateQuantity → removeItem.
          */}
          <div className="flex items-center h-8 rounded-full border border-[var(--border)] bg-[var(--surface-2)] flex-shrink-0">
            <button
              onClick={() => onUpdateQuantity(item.menuItemId, item.quantity - 1)}
              className="w-8 h-8 flex items-center justify-center text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors rounded-full"
              aria-label="Remove one"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span
              className="w-6 text-center text-xs font-bold tabular-nums select-none text-[var(--text-1)]"
              aria-live="polite"
            >
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.menuItemId, item.quantity + 1)}
              className="w-8 h-8 flex items-center justify-center text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors rounded-full"
              aria-label="Add one more"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Item name */}
          <p className="flex-1 min-w-0 text-sm font-medium text-[var(--text-1)] truncate">
            {item.name}
          </p>

          {/* Line total */}
          <p className="text-sm font-semibold text-[var(--text-1)] flex-shrink-0 tabular-nums">
            €{(item.unitPriceEur * item.quantity).toFixed(2)}
          </p>
        </li>
      ))}
    </ul>
  )
}
