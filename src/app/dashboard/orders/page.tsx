import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatusPill } from '@/components/order/StatusPill'
import type { CustomerOrderRow } from '@/types'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default async function OrderHistoryPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/orders')

  const page = Math.max(1, parseInt(searchParams.page ?? '1'))
  const offset = (page - 1) * PAGE_SIZE

  const { data: orders, count } = await supabase
    .from('orders')
    .select(
      `id, status, payment_method, created_at,
       restaurants ( name, slug, currency_label ),
       order_items ( quantity, unit_price_eur )`,
      { count: 'exact' }
    )
    .eq('user_id', user.id)
    .not('status', 'eq', 'awaiting_payment')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)
  const orderList = (orders ?? []) as unknown as CustomerOrderRow[]

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="p-1.5 -ml-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-1)]">Order history</h1>
          {count != null && count > 0 && (
            <p className="text-sm text-[var(--text-3)] mt-0.5">{count} order{count !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {/* Empty state */}
      {orderList.length === 0 && (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-12 text-center">
          <p className="text-base font-semibold text-[var(--text-2)]">No orders yet</p>
          <p className="text-sm text-[var(--text-3)] mt-1">Browse campus restaurants to place your first order.</p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--red)] hover:bg-[var(--red-dark)] text-white text-sm font-semibold transition-colors"
          >
            Browse restaurants
          </Link>
        </div>
      )}

      {/* Order grid */}
      {orderList.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orderList.map((order) => {
              const totalEur = order.order_items.reduce(
                (s, it) => s + it.unit_price_eur * it.quantity,
                0
              )
              const itemCount = order.order_items.reduce((s, it) => s + it.quantity, 0)
              return (
                <Link
                  key={order.id}
                  href={`/order/${order.id}`}
                  className="block bg-white rounded-2xl border border-[var(--border)] p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-sm font-semibold text-[var(--text-1)] truncate">
                      {order.restaurants?.name ?? 'Restaurant'}
                    </p>
                    <StatusPill status={order.status} />
                  </div>
                  <p className="text-xs text-[var(--text-3)] mb-1">
                    {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-lg font-bold text-[var(--text-1)]">€{totalEur.toFixed(2)}</p>
                  <p className="text-xs text-[var(--text-3)] mt-2">{formatDate(order.created_at)}</p>
                </Link>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              {page > 1 ? (
                <Link
                  href={`/dashboard/orders?page=${page - 1}`}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold text-[var(--text-3)] opacity-40">
                  <ChevronLeft className="w-4 h-4" /> Prev
                </span>
              )}
              <span className="text-sm text-[var(--text-3)]">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={`/dashboard/orders?page=${page + 1}`}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold text-[var(--text-3)] opacity-40">
                  Next <ChevronRight className="w-4 h-4" />
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
