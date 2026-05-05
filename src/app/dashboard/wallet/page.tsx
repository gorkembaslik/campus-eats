'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Ticket, QrCode, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import type { WalletAccount } from '@/types'

function eurEquiv(balance: number, ticketEurValue: number | null) {
  if (!ticketEurValue || ticketEurValue <= 0) return null
  return `≈ €${(balance * ticketEurValue).toFixed(2)}`
}

export default function WalletPage() {
  const { user, loading: userLoading } = useUser()
  const router = useRouter()
  const [wallets, setWallets] = useState<WalletAccount[]>([])
  const [walletsLoading, setWalletsLoading] = useState(true)
  const [qrOpen, setQrOpen] = useState(false)

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace('/login?next=/dashboard/wallet')
    }
  }, [user, userLoading, router])

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    supabase
      .from('wallet_accounts')
      .select('*, restaurants(name, slug, currency_label, ticket_eur_value)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setWallets(data ?? [])
        setWalletsLoading(false)
      })
  }, [user])

  const loading = userLoading || walletsLoading

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-1)]">My Wallet</h1>
            <p className="mt-1 text-sm text-[var(--text-3)]">
              Your balance at each campus restaurant.
            </p>
          </div>
          {user && (
            <button
              onClick={() => setQrOpen(true)}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">Show my code</span>
              <span className="sm:hidden">My QR</span>
            </button>
          )}
        </div>

        <div>
          <h2 className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wide mb-4">
            Balances
          </h2>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-[var(--border)] p-6 animate-pulse">
                  <div className="h-4 w-32 bg-[var(--surface-3)] rounded mb-4" />
                  <div className="h-8 w-24 bg-[var(--surface-3)] rounded" />
                </div>
              ))}
            </div>
          ) : wallets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[var(--border)] p-8 text-center">
              <p className="text-sm text-[var(--text-3)]">You don&apos;t have any wallets yet.</p>
              <p className="text-xs text-[var(--text-3)] mt-1 opacity-70">
                A wallet is created automatically when you place your first order at a campus restaurant.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {wallets.map((wallet) => {
                const slug = wallet.restaurants?.slug
                const card = (
                  <div className="bg-white rounded-2xl border border-[var(--border)] p-6 flex flex-col gap-3 transition-shadow hover:shadow-md group">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--text-1)]">
                        {wallet.restaurants?.name ?? 'Restaurant'}
                      </p>
                      <ArrowRight className="w-4 h-4 text-[var(--text-3)] group-hover:text-[var(--red)] transition-colors" />
                    </div>
                    <p className="text-3xl font-bold text-[var(--text-1)] tracking-tight flex items-center gap-1.5">
                      {wallet.balance.toFixed(2)}
                      <Ticket className="w-6 h-6" />
                    </p>
                    <p className="text-xs text-[var(--text-3)]">
                      Available balance
                      {(() => {
                        const equiv = eurEquiv(wallet.balance, wallet.restaurants?.ticket_eur_value ?? null)
                        return equiv ? <span className="ml-1 opacity-60">{equiv}</span> : null
                      })()}
                    </p>
                  </div>
                )

                return (
                  <div key={wallet.id} className="relative">
                    <Link href={`/dashboard/wallet/${wallet.restaurant_id}`} className="block">
                      {card}
                    </Link>
                    {slug && (
                      <Link
                        href={`/${slug}/menu`}
                        className="absolute bottom-4 right-4 text-xs font-semibold text-[var(--red)] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Order →
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* QR code modal */}
      {qrOpen && user && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[var(--text-1)]">My QR code</h2>
              <button
                onClick={() => setQrOpen(false)}
                className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-center mb-4 p-4 bg-white border border-[var(--border)] rounded-xl">
              <QRCodeSVG value={user.id} size={220} level="M" />
            </div>
            <p className="text-xs text-[var(--text-3)] text-center font-mono break-all">{user.id}</p>
            <p className="text-xs text-[var(--text-3)] mt-3 text-center">
              Show this to a cashier to top up your wallet.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
