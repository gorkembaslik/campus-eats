'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2, RotateCcw } from 'lucide-react'
import { withRole } from '@/components/auth/withRole'
import { AdminHeader } from '@/components/admin/AdminHeader'
import type { AuditRow } from '@/types'

interface FilterOption { id: string; name?: string; full_name?: string }

function todayStr() { return new Date().toISOString().slice(0, 10) }
function sevenDaysAgo() {
  const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10)
}

function AuditPage() {
  const [from, setFrom] = useState(sevenDaysAgo)
  const [to, setTo] = useState(todayStr)
  const [restaurantId, setRestaurantId] = useState('')
  const [cashierId, setCashierId] = useState('')
  const [page, setPage] = useState(1)
  const [groupBy, setGroupBy] = useState<'cashier' | 'flat'>('cashier')

  const [rows, setRows] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [restaurants, setRestaurants] = useState<FilterOption[]>([])
  const [cashiers, setCashiers] = useState<FilterOption[]>([])

  // Load filter options on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/admin/audit/restaurants').then((r) => r.json()),
      fetch('/api/admin/audit/cashiers').then((r) => r.json()),
    ]).then(([rests, cashes]) => {
      setRestaurants(rests)
      setCashiers(cashes)
    }).catch(() => toast.error('Failed to load filter options'))
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        from, to, page: String(page),
        ...(restaurantId ? { restaurantId } : {}),
        ...(cashierId ? { cashierId } : {}),
      })
      const res = await fetch(`/api/admin/audit?${params}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to load audit'); return }
      setRows(data.rows ?? [])
      setTotal(data.total ?? 0)
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [from, to, restaurantId, cashierId, page])

  useEffect(() => { fetchRows() }, [fetchRows])

  function reset() {
    setFrom(sevenDaysAgo())
    setTo(todayStr())
    setRestaurantId('')
    setCashierId('')
    setPage(1)
  }

  const totalPages = Math.ceil(total / 50)

  // Group rows by cashier
  const grouped = rows.reduce<Record<string, { name: string; rows: AuditRow[]; total: number }>>((acc, row) => {
    const cid = row.cashier?.id ?? 'unknown'
    const name = row.cashier?.full_name ?? 'Unknown cashier'
    if (!acc[cid]) acc[cid] = { name, rows: [], total: 0 }
    acc[cid].rows.push(row)
    acc[cid].total = Math.round((acc[cid].total + Number(row.amount)) * 100) / 100
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader backHref="/admin" title="Audit log" subtitle="Wallet credits by cashiers" />

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-semibold">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1) }}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-semibold">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1) }}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <select
            value={restaurantId}
            onChange={(e) => { setRestaurantId(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">All restaurants</option>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select
            value={cashierId}
            onChange={(e) => { setCashierId(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">All cashiers</option>
            {cashiers.map((c) => <option key={c.id} value={c.id}>{c.full_name ?? c.id}</option>)}
          </select>
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setGroupBy('cashier')}
              className={`px-3 py-1.5 rounded-l-xl border text-sm font-semibold transition-colors ${groupBy === 'cashier' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              By cashier
            </button>
            <button
              onClick={() => setGroupBy('flat')}
              className={`px-3 py-1.5 rounded-r-xl border-t border-b border-r text-sm font-semibold transition-colors ${groupBy === 'flat' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              Flat list
            </button>
          </div>
          <button onClick={reset} className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors" aria-label="Reset filters">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-base font-semibold text-gray-500">No credits found</p>
            <p className="text-sm text-gray-400 mt-1">Adjust the date range or filters.</p>
          </div>
        ) : groupBy === 'cashier' ? (
          <div className="space-y-4">
            {Object.entries(grouped).map(([cid, group]) => (
              <details key={cid} className="bg-white rounded-2xl border border-gray-200 overflow-hidden" open>
                <summary className="cursor-pointer px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors list-none">
                  <span className="font-semibold text-gray-900">{group.name}</span>
                  <span className="text-sm text-gray-400 flex-shrink-0">
                    {group.rows.length} credit{group.rows.length !== 1 ? 's' : ''} · {group.total.toFixed(2)} tickets
                  </span>
                </summary>
                <AuditTable rows={group.rows} />
              </details>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <AuditTable rows={rows} showCashier />
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Prev
            </button>
            <span className="text-sm text-gray-400">Page {page} · {total} total</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function AuditTable({ rows, showCashier = false }: { rows: AuditRow[]; showCashier?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
            {showCashier && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cashier</th>}
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Restaurant</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => {
            const wallet = row.wallet as { user?: { full_name?: string | null; email?: string | null }; restaurant?: { name?: string } } | null
            return (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-xs">
                  {new Date(row.created_at).toLocaleString('en-GB', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                {showCashier && <td className="px-4 py-3 text-gray-700 text-xs">{row.cashier?.full_name ?? '—'}</td>}
                <td className="px-4 py-3 text-gray-700 text-xs">
                  <p>{wallet?.user?.full_name ?? '—'}</p>
                  {wallet?.user?.email && <p className="text-gray-400">{wallet.user.email}</p>}
                </td>
                <td className="px-4 py-3 text-gray-700 text-xs">{wallet?.restaurant?.name ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-gray-700 text-xs">{row.ticket_code ?? '—'}</td>
                <td className="px-4 py-3 text-right font-bold text-green-700 text-sm">+{Number(row.amount).toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px] truncate">{row.note ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default withRole(['admin'], AuditPage)
