'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ChevronLeft, Loader2, Minus, Plus, Trash2, ScanLine, X } from 'lucide-react'
import type { DenominationMap } from '@/types'

interface Restaurant {
  id: string
  name: string
  currency_label: string
  ticket_denominations: DenominationMap
}

interface CustomerInfo {
  id: string
  full_name: string | null
  balance: number
}

interface BasketItem {
  code: string
  quantity: number
  value: number
}

export function CashierCreditClient({ restaurants }: { restaurants: Restaurant[] }) {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(restaurants[0]?.id ?? '')
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [manualUuid, setManualUuid] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [customer, setCustomer] = useState<CustomerInfo | null>(null)
  const [basket, setBasket] = useState<BasketItem[]>([])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const scannerRef = useRef<{ stop?: () => Promise<void>; clear?: () => void } | null>(null)
  const idempotencyRef = useRef<string | null>(null)

  const selectedRestaurant = restaurants.find((r) => r.id === selectedRestaurantId) ?? restaurants[0]
  const denoms = selectedRestaurant?.ticket_denominations ?? {}
  const denomEntries = Object.entries(denoms).sort(([a], [b]) => a.localeCompare(b))

  const basketTotal = basket.reduce((s, it) => s + it.value * it.quantity, 0)

  async function stopScan() {
    try { await scannerRef.current?.stop?.() } catch { /* ignore */ }
    try { scannerRef.current?.clear?.() } catch { /* ignore */ }
    scannerRef.current = null
    setScanning(false)
  }

  useEffect(() => {
    return () => { stopScan() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startScan() {
    setScanError(null)
    setScanning(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner as { stop?: () => Promise<void>; clear?: () => void }
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decoded: string) => {
          await stopScan()
          await lookupCustomer(decoded.trim())
        },
        () => { /* swallow per-frame parse errors */ }
      )
    } catch {
      setScanning(false)
      setScanError('Camera unavailable. Use manual UUID entry below.')
    }
  }

  async function lookupCustomer(userId: string) {
    setLookingUp(true)
    setScanError(null)
    setCustomer(null)
    setBasket([])
    idempotencyRef.current = null

    try {
      const res = await fetch(
        `/api/cashier/wallet/lookup?userId=${encodeURIComponent(userId)}&restaurantId=${encodeURIComponent(selectedRestaurantId)}`
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setScanError(body.error ?? 'Customer not found')
        return
      }
      setCustomer(body)
      idempotencyRef.current = crypto.randomUUID()
    } catch {
      setScanError('Network error — try again')
    } finally {
      setLookingUp(false)
    }
  }

  function addToBasket(code: string, value: number) {
    setBasket((prev) => {
      const existing = prev.find((it) => it.code === code)
      if (existing) {
        return prev.map((it) => it.code === code ? { ...it, quantity: it.quantity + 1 } : it)
      }
      return [...prev, { code, value, quantity: 1 }]
    })
  }

  function adjustQuantity(code: string, delta: number) {
    setBasket((prev) => {
      const next = prev.map((it) => it.code === code ? { ...it, quantity: it.quantity + delta } : it)
        .filter((it) => it.quantity > 0)
      return next
    })
  }

  async function handleSubmit() {
    setFormError(null)
    if (!customer) { setFormError('Scan or look up a customer first'); return }
    if (basket.length === 0) { setFormError('Add at least one ticket to the basket'); return }
    if (!idempotencyRef.current) idempotencyRef.current = crypto.randomUUID()

    setSubmitting(true)
    try {
      const res = await fetch('/api/cashier/wallet/credit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyRef.current,
        },
        body: JSON.stringify({
          userId: customer.id,
          restaurantId: selectedRestaurantId,
          items: basket.map(({ code, quantity }) => ({ code, quantity })),
          note: note.trim() || null,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFormError(body.error ?? 'Credit failed')
        return
      }
      toast.success(
        `Credited ${body.totalCredited.toFixed(2)} tickets — new balance ${body.newBalance.toFixed(2)}`
      )
      setCustomer(null)
      setManualUuid('')
      setBasket([])
      setNote('')
      idempotencyRef.current = null
    } catch {
      setFormError('Network error — try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--surface-2)]">
      {/* Header */}
      <header className="bg-white border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/cashier" className="p-1.5 -ml-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-base font-bold text-[var(--text-1)]">Credit Tickets</h1>
            </div>
            {/* Restaurant switcher */}
            {restaurants.length > 1 && (
              <select
                value={selectedRestaurantId}
                onChange={(e) => {
                  setSelectedRestaurantId(e.target.value)
                  setCustomer(null)
                  setBasket([])
                  idempotencyRef.current = null
                }}
                className="text-sm border border-[var(--border)] rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--red)] bg-white"
              >
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* ── Step 1: Scan / lookup ─────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-[var(--border)] p-5 space-y-4">
          <h2 className="text-sm font-bold text-[var(--text-1)] uppercase tracking-wide">1 · Scan customer QR</h2>

          {/* Scanner area */}
          {scanning ? (
            <div className="space-y-3">
              <div id="qr-reader" className="rounded-xl overflow-hidden" />
              <button
                onClick={stopScan}
                className="flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--text-1)]"
              >
                <X className="w-4 h-4" /> Cancel scan
              </button>
            </div>
          ) : (
            <button
              onClick={startScan}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--red)] hover:bg-[var(--red-dark)] text-white text-sm font-semibold transition-colors"
            >
              <ScanLine className="w-4 h-4" />
              Start camera scanner
            </button>
          )}

          {scanError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{scanError}</p>
          )}

          {/* Manual UUID fallback */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wide mb-1.5">Or enter customer UUID manually</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualUuid}
                onChange={(e) => setManualUuid(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="flex-1 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-mono text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--red)]"
              />
              <button
                onClick={() => lookupCustomer(manualUuid.trim())}
                disabled={lookingUp || !manualUuid.trim()}
                className="px-4 py-2 rounded-xl bg-[var(--surface-3)] hover:bg-[var(--border)] text-sm font-semibold text-[var(--text-1)] disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Look up'}
              </button>
            </div>
          </div>

          {/* Customer card */}
          {customer && (
            <div className="bg-[var(--surface-2)] rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--text-1)]">{customer.full_name ?? 'Unknown'}</p>
                <p className="text-xs text-[var(--text-3)] mt-0.5">
                  Current balance: <span className="font-semibold text-[var(--text-2)]">{customer.balance.toFixed(2)} tickets</span>
                </p>
              </div>
              <button
                onClick={() => { setCustomer(null); setBasket([]); idempotencyRef.current = null }}
                className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-3)] transition-colors"
                aria-label="Clear customer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>

        {/* ── Step 2: Denomination basket ────────────────────────────────────── */}
        {customer && (
          <section className="bg-white rounded-2xl border border-[var(--border)] p-5 space-y-4">
            <h2 className="text-sm font-bold text-[var(--text-1)] uppercase tracking-wide">2 · Add tickets</h2>

            {/* Denomination buttons */}
            <div className="flex flex-wrap gap-2">
              {denomEntries.map(([code, value]) => (
                <button
                  key={code}
                  onClick={() => addToBasket(code, value)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-[var(--border)] hover:border-[var(--red)] hover:bg-[var(--red-light)] text-sm font-semibold text-[var(--text-1)] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[var(--red)]" />
                  <span className="font-mono">{code}</span>
                  <span className="text-[var(--text-3)] font-normal">{value} ticket{value !== 1 ? 's' : ''}</span>
                </button>
              ))}
            </div>

            {/* Basket list */}
            {basket.length > 0 && (
              <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden">
                {basket.map((it) => (
                  <li key={it.code} className="flex items-center gap-3 px-4 py-3 bg-white">
                    <span className="font-mono text-sm font-semibold text-[var(--text-1)] w-10">{it.code}</span>
                    <span className="text-xs text-[var(--text-3)] flex-1">{it.value} ticket{it.value !== 1 ? 's' : ''} each</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => adjustQuantity(it.code, -1)}
                        className="p-1 rounded-lg border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-2)] transition-colors"
                        aria-label="Remove one"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-sm font-bold text-[var(--text-1)] w-6 text-center">{it.quantity}</span>
                      <button
                        onClick={() => adjustQuantity(it.code, 1)}
                        className="p-1 rounded-lg border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-2)] transition-colors"
                        aria-label="Add one"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-[var(--text-1)] w-16 text-right">
                      {(it.value * it.quantity).toFixed(2)}
                    </span>
                    <button
                      onClick={() => setBasket((prev) => prev.filter((b) => b.code !== it.code))}
                      className="p-1 rounded-lg text-[var(--text-3)] hover:text-red-500 hover:bg-red-50 transition-colors"
                      aria-label="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
                <li className="flex items-center justify-between px-4 py-3 bg-[var(--surface-2)]">
                  <span className="text-sm font-semibold text-[var(--text-2)]">Total</span>
                  <span className="text-base font-bold text-[var(--text-1)]">{basketTotal.toFixed(2)} tickets</span>
                </li>
              </ul>
            )}

            {/* Optional note */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-3)] uppercase tracking-wide mb-1.5">
                Note (optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Orientation week reimbursement"
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--red)]"
              />
            </div>

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{formError}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || basket.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--red)] hover:bg-[var(--red-dark)] disabled:opacity-50 text-white text-sm font-bold transition-colors"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Processing…' : `Credit ${basketTotal.toFixed(2)} tickets`}
            </button>
          </section>
        )}
      </main>
    </div>
  )
}
