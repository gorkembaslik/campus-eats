'use client'

import type { CashierOrder, OrderStatus } from '@/types'

interface Props {
  order: CashierOrder
  currencyLabel: string
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>
  onConfirm: (orderId: string) => Promise<void>
  onCancel: (orderId: string) => Promise<void>
}

const STATUS_STYLES: Record<OrderStatus, { bg: string; text: string; label: string }> = {
  awaiting_payment: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Awaiting Payment' },
  pending:          { bg: 'bg-amber-50',  text: 'text-amber-700',  label: 'Pending'          },
  preparing:        { bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'Preparing'        },
  ready:            { bg: 'bg-green-50',  text: 'text-green-700',  label: 'Ready!'           },
  completed:        { bg: 'bg-gray-50',   text: 'text-gray-500',   label: 'Completed'        },
  cancelled:        { bg: 'bg-red-50',    text: 'text-red-500',    label: 'Cancelled'        },
}

export function OrderCard({ order, currencyLabel, onStatusChange, onConfirm, onCancel }: Props) {
  const pickupCode = order.id.slice(-6).toUpperCase()
  const customerName = order.users?.full_name ?? 'Unknown'
  const payment = order.payments[0] ?? null
  const statusStyle = STATUS_STYLES[order.status]
  const isActive = order.status === 'pending' || order.status === 'preparing' || order.status === 'ready'

  const itemSummary = order.order_items
    .map((i) => `${i.quantity}× ${i.menu_items?.name ?? 'Item'}`)
    .join(', ')

  return (
    <div
      className="bg-white rounded-2xl border border-[var(--border)] flex flex-col overflow-hidden"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Header: pickup code + customer + status */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
        <div>
          <span className="font-mono text-xl font-extrabold text-[var(--text-1)] tracking-widest">
            {pickupCode}
          </span>
          <p className="text-sm text-[var(--text-3)] mt-0.5 truncate max-w-[10rem]">{customerName}</p>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${statusStyle.bg} ${statusStyle.text}`}
        >
          {statusStyle.label}
        </span>
      </div>

      {/* Items */}
      <div className="px-4 pb-3 flex-1">
        <p className="text-sm text-[var(--text-2)] leading-relaxed">{itemSummary}</p>
      </div>

      {/* Payment summary */}
      {payment && (
        <div className="px-4 py-2 border-t border-[var(--border)] flex flex-wrap items-center gap-x-3 gap-y-1">
          {payment.wallet_units_provisioned != null && payment.wallet_units_provisioned > 0 && (
            <span className="text-xs text-[var(--text-3)]">
              {payment.wallet_units_provisioned.toFixed(2)} {currencyLabel}
            </span>
          )}
          {payment.stripe_amount_eur != null && payment.stripe_amount_eur > 0 && (
            <span className="text-xs text-[var(--text-3)]">
              €{payment.stripe_amount_eur.toFixed(2)} card
            </span>
          )}
        </div>
      )}

      {/* Action buttons */}
      {isActive && (
        <div className="px-4 py-3 border-t border-[var(--border)] flex flex-col gap-2">
          {order.status === 'pending' && (
            <>
              <button
                onClick={() => onStatusChange(order.id, 'preparing')}
                className="w-full py-2 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              >
                Start preparing
              </button>
              <button
                onClick={() => onCancel(order.id)}
                className="w-full py-2 rounded-xl text-sm font-semibold text-[var(--red)] hover:bg-[var(--red-light)] transition-colors"
              >
                Cancel order
              </button>
            </>
          )}
          {order.status === 'preparing' && (
            <>
              <button
                onClick={() => onStatusChange(order.id, 'ready')}
                className="w-full py-2 rounded-xl text-sm font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors"
              >
                Mark ready
              </button>
              <button
                onClick={() => onCancel(order.id)}
                className="w-full py-2 rounded-xl text-sm font-semibold text-[var(--red)] hover:bg-[var(--red-light)] transition-colors"
              >
                Cancel order
              </button>
            </>
          )}
          {order.status === 'ready' && (
            <button
              onClick={() => onConfirm(order.id)}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
              style={{ backgroundColor: 'var(--red)' }}
            >
              Confirm pickup ✓
            </button>
          )}
        </div>
      )}
    </div>
  )
}
