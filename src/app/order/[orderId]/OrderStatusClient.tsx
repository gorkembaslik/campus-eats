'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Clock,
  UtensilsCrossed,
  Bell,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  AlertCircle,
  Check,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { OrderStatus, PaymentMethod } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string
  quantity: number
  unit_price_eur: number
  unit_price_wallet_units: number
  menu_items: { name: string } | null
}

export interface OrderPayment {
  wallet_units_provisioned: number | null
  stripe_amount_eur: number | null
}

export interface InitialOrder {
  id: string
  status: OrderStatus
  payment_method: PaymentMethod
  created_at: string
  restaurants: { name: string; currency_label: string; ticket_eur_value: number | null } | null
  order_items: OrderItem[]
  payments: OrderPayment[]
}

interface Props {
  initialOrder: InitialOrder
  /** redirect_status param Stripe appends after 3DS authentication */
  stripeRedirectStatus: string | undefined
  /** True only when the current viewer is the order owner — shows the cancel button */
  canCancel: boolean
}

// ── Step config ───────────────────────────────────────────────────────────────

const STEPS: { key: OrderStatus; label: string; sublabel: string; Icon: React.ElementType }[] = [
  { key: 'pending',   label: 'Order Placed',   sublabel: 'We received your order',  Icon: Clock           },
  { key: 'preparing', label: 'Preparing',       sublabel: 'The kitchen is on it',    Icon: UtensilsCrossed },
  { key: 'ready',     label: 'Ready',           sublabel: 'Head to the counter',     Icon: Bell            },
  { key: 'completed', label: 'Picked Up',       sublabel: 'Enjoy your meal!',        Icon: CheckCircle2    },
]

const STEP_KEYS = STEPS.map((s) => s.key)

// ── Component ─────────────────────────────────────────────────────────────────

export function OrderStatusClient({ initialOrder, stripeRedirectStatus, canCancel }: Props) {
  const [status, setStatus] = useState<OrderStatus>(initialOrder.status)
  const prevStatusRef = useRef<OrderStatus>(initialOrder.status)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const supabase = createClient()

  // Re-fetch status when tab is refocused (browser throttles WebSockets in background tabs)
  useEffect(() => {
    async function onVisible() {
      if (document.visibilityState !== 'visible') return
      const { data } = await supabase
        .from('orders')
        .select('status')
        .eq('id', initialOrder.id)
        .maybeSingle()
      if (data?.status) setStatus(data.status as OrderStatus)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrder.id])

  useEffect(() => {
    const channel = supabase
      .channel(`order-status-${initialOrder.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${initialOrder.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: OrderStatus }).status
          prevStatusRef.current = status
          setStatus(newStatus)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrder.id])

  async function handleCancel() {
    if (!confirm('Cancel this order? Any wallet funds will be returned immediately.')) return
    setCancelling(true)
    setCancelError(null)
    const res = await fetch(`/api/orders/${initialOrder.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setCancelError(body.error ?? 'Could not cancel. Try again.')
      setCancelling(false)
    }
    // On success: Realtime subscription updates status → 'cancelled' automatically
  }

  const isAwaitingPayment = status === 'awaiting_payment'
  // Treat awaiting_payment as step 0 (pending) in the stepper — it resolves in < 2s via webhook.
  const currentStepIndex = STEP_KEYS.indexOf(isAwaitingPayment ? 'pending' : status)
  const isCancelled = status === 'cancelled'
  const isReady = status === 'ready'

  const payment = initialOrder.payments[0] ?? null
  const currencyLabel = initialOrder.restaurants?.currency_label ?? 'tickets'
  const ticketEurValue = initialOrder.restaurants?.ticket_eur_value ?? 0

  const totalEur = initialOrder.order_items.reduce(
    (sum, item) => sum + item.unit_price_eur * item.quantity,
    0
  )
  const totalWalletUnits = initialOrder.order_items.reduce(
    (sum, item) => sum + item.unit_price_wallet_units * item.quantity,
    0
  )

  return (
    <div className="min-h-screen bg-[var(--surface-2)]">
      {/* CSS animations for hero checkmark */}
      <style>{`
        @keyframes ceScaleIn {
          0%   { transform: scale(0); opacity: 0; }
          70%  { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes ceDrawCheck {
          from { stroke-dashoffset: 64; }
          to   { stroke-dashoffset: 0;  }
        }
        .ce-scale-in {
          animation: ceScaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .ce-draw-check {
          stroke-dasharray: 64;
          stroke-dashoffset: 64;
          animation: ceDrawCheck 0.45s 0.3s ease-out forwards;
        }
      `}</style>

      {/* Ready banner — sticky top */}
      {isReady && (
        <div className="sticky top-0 z-20 bg-green-500 px-4 py-4 shadow-lg animate-in slide-in-from-top duration-300">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <span className="flex-shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-white animate-bounce" />
            </span>
            <div>
              <p className="font-bold text-white text-base leading-tight">Your order is ready!</p>
              <p className="text-green-100 text-sm mt-0.5">Go pick it up at the counter.</p>
            </div>
          </div>
        </div>
      )}

      {/* Stripe redirect failure */}
      {stripeRedirectStatus && stripeRedirectStatus !== 'succeeded' && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">
              Payment could not be authorised ({stripeRedirectStatus}). Your order has been
              recorded but payment is pending — please contact support.
            </p>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>

        {/* ── Hero card ── */}
        <div className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="flex flex-col items-center py-8 px-6 text-center">
            {isCancelled ? (
              <div className="w-20 h-20 rounded-full bg-[var(--surface-2)] border-2 border-[var(--border)] flex items-center justify-center mb-5">
                <XCircle className="w-10 h-10 text-[var(--text-3)]" />
              </div>
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mb-5 ce-scale-in"
                style={{ backgroundColor: 'var(--red)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10" aria-hidden>
                  <polyline
                    points="4,13 9,18 20,6"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ce-draw-check"
                  />
                </svg>
              </div>
            )}

            <h1 className="text-2xl font-extrabold text-[var(--text-1)]">
              {isCancelled ? 'Order Cancelled' : 'Order Placed!'}
            </h1>

            {initialOrder.restaurants?.name && (
              <p className="text-sm text-[var(--text-3)] mt-1">
                {initialOrder.restaurants.name}
              </p>
            )}

            <span className="mt-3 inline-block text-xs font-mono text-[var(--text-3)] bg-[var(--surface-2)] px-3 py-1 rounded-full">
              #{initialOrder.id.slice(0, 8).toUpperCase()}
            </span>

            {/* Pickup code shown to cashier at counter */}
            {!isCancelled && (
              <div className="mt-4 px-5 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-center">
                <p className="text-xs text-[var(--text-3)] mb-1">Pickup code</p>
                <p className="font-mono text-2xl font-extrabold text-[var(--text-1)] tracking-widest">
                  {initialOrder.id.slice(-6).toUpperCase()}
                </p>
                <p className="text-xs text-[var(--text-3)] mt-1">Show this to the cashier</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Status stepper card ── */}
        <div className="bg-white rounded-2xl border border-[var(--border)] px-5 py-5">
          <h2 className="text-sm font-bold text-[var(--text-1)] mb-5">Order Status</h2>
          {isAwaitingPayment && (
            <div className="mb-4 flex items-center gap-2 text-sm text-[var(--text-2)]">
              <div className="w-4 h-4 border-2 border-[var(--red)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
              Confirming payment…
            </div>
          )}
          {isCancelled ? (
            <CancelledState />
          ) : (
            <StepIndicator currentIndex={currentStepIndex} />
          )}
        </div>

        {/* ── Cancel button (pending only, owner only) ── */}
        {canCancel && status === 'pending' && (
          <div className="space-y-2">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full py-3 rounded-2xl border border-[var(--border)] text-sm font-semibold text-[var(--text-2)] hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {cancelling ? 'Cancelling…' : 'Cancel order'}
            </button>
            {cancelError && (
              <p className="text-xs text-red-600 text-center">{cancelError}</p>
            )}
            <p className="text-xs text-[var(--text-3)] text-center">
              You can cancel before the kitchen starts on your order.
            </p>
          </div>
        )}

        {/* ── Order summary card ── */}
        <div className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-bold text-[var(--text-1)]">Your Order</h2>
          </div>

          <ul className="divide-y divide-[var(--border)]">
            {initialOrder.order_items.map((item) => (
              <li key={item.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span
                    className="text-sm font-bold flex-shrink-0"
                    style={{ color: 'var(--red)' }}
                  >
                    {item.quantity}×
                  </span>
                  <span className="text-sm text-[var(--text-1)] truncate">
                    {item.menu_items?.name ?? 'Item'}
                  </span>
                </div>
                <span className="text-sm font-semibold text-[var(--text-1)] flex-shrink-0 tabular-nums">
                  €{(item.unit_price_eur * item.quantity).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>

          {/* Total row */}
          <div className="px-5 py-4 flex items-center justify-between bg-[var(--surface-2)] border-t border-[var(--border)]">
            <span className="text-sm font-bold text-[var(--text-1)]">Total</span>
            <div className="text-right">
              <p className="text-sm font-extrabold text-[var(--text-1)] tabular-nums">
                €{totalEur.toFixed(2)}
              </p>
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                {totalWalletUnits.toFixed(2)} {currencyLabel}
                {ticketEurValue > 0 && (
                  <span className="ml-1">
                    (≈ €{(totalWalletUnits * ticketEurValue).toFixed(2)})
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ── Payment card ── */}
        {payment && (
          <div className="bg-white rounded-2xl border border-[var(--border)] px-5 py-5">
            <h2 className="text-sm font-bold text-[var(--text-1)] mb-3">Payment</h2>
            <PaymentSummary
              payment={payment}
              paymentMethod={initialOrder.payment_method}
              currencyLabel={currencyLabel}
              ticketEurValue={ticketEurValue}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Vertical step indicator (DoorDash style) ──────────────────────────────────

function StepIndicator({ currentIndex }: { currentIndex: number }) {
  return (
    <div>
      {STEPS.map((step, i) => {
        const isDone = i < currentIndex
        const isActive = i === currentIndex
        const isUpcoming = i > currentIndex
        const isLast = i === STEPS.length - 1

        return (
          <div key={step.key} className="flex gap-4">
            {/* Left column: dot + connector line */}
            <div className="flex flex-col items-center">
              <div
                className={[
                  'relative w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500',
                  isDone ? '' : '',
                  isActive ? 'ring-4' : '',
                  isUpcoming ? 'border-2' : '',
                ].join(' ')}
                style={
                  isDone
                    ? { backgroundColor: 'var(--red)' }
                    : isActive
                    ? {
                        backgroundColor: 'var(--red)',
                        boxShadow: '0 0 0 4px var(--red-light)',
                      }
                    : {
                        backgroundColor: 'var(--surface-2)',
                        border: '2px solid var(--border)',
                      }
                }
              >
                {isDone ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <step.Icon
                    className="w-4 h-4"
                    style={{ color: isActive ? 'white' : 'var(--text-3)' }}
                  />
                )}

                {/* Pulse ring on active step */}
                {isActive && (
                  <span
                    className="absolute inset-0 rounded-full animate-ping opacity-25"
                    style={{ backgroundColor: 'var(--red)' }}
                  />
                )}
              </div>

              {/* Connecting line */}
              {!isLast && (
                <div
                  className="w-0.5 flex-1 min-h-[2.5rem] mt-1 mb-1 transition-colors duration-500"
                  style={{ backgroundColor: isDone ? 'var(--red)' : 'var(--border)' }}
                />
              )}
            </div>

            {/* Right column: text */}
            <div className={['flex flex-col justify-start', isLast ? 'pb-0' : 'pb-1'].join(' ')}>
              <p
                className="text-sm font-semibold leading-[2.25rem]"
                style={{ color: isDone || isActive ? 'var(--text-1)' : 'var(--text-3)' }}
              >
                {step.label}
              </p>
              {(isActive || isDone) && (
                <p
                  className="-mt-2 text-xs pb-3"
                  style={{ color: isActive ? 'var(--red)' : 'var(--text-3)' }}
                >
                  {step.sublabel}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Cancelled state ───────────────────────────────────────────────────────────

function CancelledState() {
  return (
    <div className="text-center py-2">
      <p className="text-sm font-semibold text-[var(--text-2)]">This order was cancelled.</p>
      <p className="text-xs text-[var(--text-3)] mt-1 max-w-xs mx-auto">
        Any held wallet funds have been returned to your balance. Stripe holds will be released
        automatically.
      </p>
    </div>
  )
}

// ── Payment summary ───────────────────────────────────────────────────────────

function PaymentSummary({
  payment,
  paymentMethod,
  currencyLabel,
  ticketEurValue,
}: {
  payment: OrderPayment
  paymentMethod: PaymentMethod
  currencyLabel: string
  ticketEurValue: number
}) {
  const rows: { label: string; value: string; sub?: string }[] = []

  if (payment.wallet_units_provisioned && payment.wallet_units_provisioned > 0) {
    rows.push({
      label: 'Wallet',
      value: `${payment.wallet_units_provisioned.toFixed(2)} ${currencyLabel}`,
      sub: ticketEurValue > 0
        ? `≈ €${(payment.wallet_units_provisioned * ticketEurValue).toFixed(2)}`
        : undefined,
    })
  }

  if (payment.stripe_amount_eur && payment.stripe_amount_eur > 0) {
    rows.push({
      label: 'Card (Stripe)',
      value: `€${payment.stripe_amount_eur.toFixed(2)}`,
    })
  }

  if (rows.length === 0) return null

  return (
    <dl className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between text-sm">
          <dt className="text-[var(--text-3)]">{row.label}</dt>
          <dd className="text-right">
            <span className="font-semibold text-[var(--text-1)]">{row.value}</span>
            {row.sub && (
              <span className="block text-xs text-[var(--text-3)]">{row.sub}</span>
            )}
          </dd>
        </div>
      ))}
      <div className="pt-2 border-t border-[var(--border)] flex justify-between text-xs text-[var(--text-3)]">
        <span>Held until pickup, then captured</span>
        <span className="capitalize">{paymentMethod}</span>
      </div>
    </dl>
  )
}
