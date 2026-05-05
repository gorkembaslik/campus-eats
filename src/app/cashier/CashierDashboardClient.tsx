'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { CreditCard } from 'lucide-react'
import type { CashierOrder, OrderStatus } from '@/types'
import { OrderCard } from './OrderCard'

interface Restaurant {
  id: string
  name: string
  currency_label: string | null
  ticket_eur_value: number | null
}

interface Props {
  restaurants: Restaurant[]
}

export function CashierDashboardClient({ restaurants }: Props) {
  const [selectedId, setSelectedId] = useState(restaurants[0]?.id ?? '')
  const [activeOrders, setActiveOrders] = useState<CashierOrder[]>([])
  const [historyOrders, setHistoryOrders] = useState<CashierOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  const fetchOrders = useCallback(async (restaurantId: string) => {
    if (!restaurantId) return
    try {
      const res = await fetch(`/api/cashier/orders?restaurantId=${restaurantId}`)
      if (!res.ok) {
        toast.error('Failed to load orders')
        return
      }
      const data = await res.json()
      setActiveOrders(data.active ?? [])
      setHistoryOrders(data.history ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    fetchOrders(selectedId)
  }, [selectedId, fetchOrders])

  // Re-fetch when tab is refocused (browser throttles WebSockets in background tabs)
  useEffect(() => {
    if (!selectedId) return
    function onVisible() {
      if (document.visibilityState === 'visible') fetchOrders(selectedId)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [selectedId, fetchOrders])

  // Realtime: subscribe to all order changes for the selected restaurant.
  // On any event, re-fetch the full lists so joins (users, order_items) stay fresh.
  useEffect(() => {
    if (!selectedId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`cashier-orders-${selectedId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${selectedId}` },
        () => { fetchOrders(selectedId) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedId, fetchOrders])

  async function handleStatusChange(orderId: string, newStatus: OrderStatus) {
    const res = await fetch(`/api/cashier/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Failed to update status')
    }
    // Realtime will trigger a re-fetch automatically.
  }

  async function handleConfirm(orderId: string) {
    if (!window.confirm('Confirm pickup? This will capture the payment — this cannot be undone.')) return
    const toastId = toast.loading('Confirming pickup…')
    const res = await fetch(`/api/cashier/orders/${orderId}/confirm`, { method: 'POST' })
    toast.dismiss(toastId)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Failed to confirm pickup')
    } else {
      toast.success('Order completed!')
    }
  }

  async function handleCancel(orderId: string) {
    if (!window.confirm('Cancel this order? Wallet funds will be released immediately.')) return
    const res = await fetch(`/api/cashier/orders/${orderId}/cancel`, { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Failed to cancel order')
    } else {
      toast.success('Order cancelled')
    }
  }

  const selectedRestaurant = restaurants.find((r) => r.id === selectedId)
  const currencyLabel = selectedRestaurant?.currency_label ?? '€'

  if (restaurants.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-[var(--text-3)]">No active restaurants found.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="bg-white border-b border-[var(--border)]" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[var(--text-1)]">Live Order Queue</h1>
            {selectedRestaurant && (
              <p className="text-sm text-[var(--text-3)] mt-0.5 truncate">{selectedRestaurant.name}</p>
            )}
          </div>

          {/* Restaurant switcher (multi-restaurant V2) */}
          {restaurants.length > 1 && (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="text-sm border border-[var(--border)] rounded-xl px-3 py-2 bg-white text-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-[var(--red)]"
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
          <Link
            href="/cashier/credit"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors flex-shrink-0"
          >
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Credit tickets</span>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">

        {/* ── Active orders ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-bold text-[var(--text-1)]">Active</h2>
            {!loading && activeOrders.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--red)' }}>
                {activeOrders.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-52 rounded-2xl bg-[var(--surface-3)] animate-pulse" />
              ))}
            </div>
          ) : activeOrders.length === 0 ? (
            <div
              className="rounded-2xl border border-[var(--border)] bg-white px-6 py-10 text-center"
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              <p className="text-sm font-semibold text-[var(--text-2)]">No active orders</p>
              <p className="text-xs text-[var(--text-3)] mt-1">New orders will appear here in real time.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  currencyLabel={currencyLabel}
                  onStatusChange={handleStatusChange}
                  onConfirm={handleConfirm}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Today's history (collapsed by default) ── */}
        <section>
          <button
            onClick={() => setShowHistory((h) => !h)}
            className="flex items-center gap-2 text-sm font-bold text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
          >
            Today&apos;s History
            <span className="text-xs font-normal text-[var(--text-3)]">
              ({historyOrders.length})
            </span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {showHistory && (
            <div className="mt-4">
              {historyOrders.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border)] bg-white px-6 py-8 text-center">
                  <p className="text-sm text-[var(--text-3)]">No completed or cancelled orders today.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {historyOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      currencyLabel={currencyLabel}
                      onStatusChange={handleStatusChange}
                      onConfirm={handleConfirm}
                      onCancel={handleCancel}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
