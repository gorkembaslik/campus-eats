import type { OrderStatus } from '@/types'

const META: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  awaiting_payment: { label: 'Confirming payment', bg: 'bg-yellow-50',               text: 'text-yellow-700' },
  pending:          { label: 'Order placed',        bg: 'bg-amber-50',                text: 'text-amber-700'  },
  preparing:        { label: 'Preparing',           bg: 'bg-blue-50',                 text: 'text-blue-700'   },
  ready:            { label: 'Ready for pickup',    bg: 'bg-green-50',                text: 'text-green-700'  },
  completed:        { label: 'Completed',           bg: 'bg-[var(--surface-3)]',      text: 'text-[var(--text-2)]' },
  cancelled:        { label: 'Cancelled',           bg: 'bg-red-50',                  text: 'text-red-500'    },
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const m = META[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  )
}
