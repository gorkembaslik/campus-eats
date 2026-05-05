import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { WalletTransaction, TransactionType } from '@/types'

export const dynamic = 'force-dynamic'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function cleanNote(note: string | null): string | null {
  if (!note) return null
  return note.replace(/^idem:[0-9a-f-]{36}\s*\|\s*/i, '').trim() || null
}

function labelFor(type: TransactionType): string {
  switch (type) {
    case 'credit':    return 'Top-up'
    case 'debit':     return 'Order charged'
    case 'provision': return 'Order hold'
    case 'release':   return 'Hold released'
  }
}

function signedAmount(type: TransactionType, amount: number): string {
  const positive = type === 'credit' || type === 'release'
  return `${positive ? '+' : '−'}${amount.toFixed(2)}`
}

function amountColor(type: TransactionType): string {
  if (type === 'credit' || type === 'release') return 'text-[var(--success)]'
  return 'text-[var(--red)]'
}

function typeBadge(type: TransactionType): string {
  switch (type) {
    case 'credit':    return 'bg-green-100 text-green-700'
    case 'release':   return 'bg-gray-100 text-gray-500'
    case 'debit':     return 'bg-red-100 text-red-600'
    case 'provision': return 'bg-amber-100 text-amber-700'
  }
}

function eurEquiv(balance: number, ticketEurValue: number | null) {
  if (!ticketEurValue || ticketEurValue <= 0) return null
  return `≈ €${(balance * ticketEurValue).toFixed(2)}`
}

export default async function WalletDetailPage({
  params,
}: {
  params: { restaurantId: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/wallet/${params.restaurantId}`)

  const { data: wallet } = await supabase
    .from('wallet_accounts')
    .select('id, user_id, restaurant_id, balance, restaurants(name, slug, currency_label, ticket_eur_value)')
    .eq('user_id', user.id)
    .eq('restaurant_id', params.restaurantId)
    .maybeSingle()

  if (!wallet) notFound()

  const { data: transactions } = await supabase
    .from('wallet_transactions')
    .select('id, wallet_id, cashier_id, type, amount, ticket_code, note, created_at')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const restaurant = wallet.restaurants as unknown as { name: string; slug: string | null; currency_label: string | null; ticket_eur_value: number | null } | null
  const txList = (transactions ?? []) as WalletTransaction[]

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/wallet"
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Wallet
      </Link>

      {/* Balance card */}
      <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
        <p className="text-sm font-semibold text-[var(--text-2)]">{restaurant?.name ?? 'Restaurant'}</p>
        <p className="text-4xl font-bold text-[var(--text-1)] tracking-tight flex items-center gap-2 mt-2">
          {Number(wallet.balance).toFixed(2)}
          <Ticket className="w-7 h-7" />
        </p>
        {(() => {
          const equiv = eurEquiv(Number(wallet.balance), restaurant?.ticket_eur_value ?? null)
          return equiv ? <p className="text-sm text-[var(--text-3)] mt-1">{equiv}</p> : null
        })()}
        {restaurant?.slug && (
          <Link
            href={`/${restaurant.slug}/menu`}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--red)] hover:bg-[var(--red-dark)] text-white text-sm font-semibold transition-colors"
          >
            Order from {restaurant.name}
          </Link>
        )}
      </div>

      {/* Transaction list */}
      <section>
        <h2 className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wide mb-3">
          Recent transactions
        </h2>

        {txList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[var(--border)] p-8 text-center">
            <p className="text-sm text-[var(--text-3)]">No transactions yet.</p>
            <p className="text-xs text-[var(--text-3)] mt-1 opacity-70">
              Top-ups and orders will appear here.
            </p>
          </div>
        ) : (
          <ul className="bg-white rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
            {txList.map((tx) => {
              const note = cleanNote(tx.note)
              return (
                <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${typeBadge(tx.type as TransactionType)}`}>
                    {labelFor(tx.type as TransactionType)}
                  </span>
                  <div className="flex-1 min-w-0">
                    {tx.ticket_code && (
                      <p className="text-xs font-mono text-[var(--text-3)]">code {tx.ticket_code}</p>
                    )}
                    {note && (
                      <p className="text-xs text-[var(--text-3)] truncate">{note}</p>
                    )}
                    <p className="text-xs text-[var(--text-3)] mt-0.5">{formatDate(tx.created_at)}</p>
                  </div>
                  <p className={`text-sm font-bold flex-shrink-0 ${amountColor(tx.type as TransactionType)}`}>
                    {signedAmount(tx.type as TransactionType, Number(tx.amount))}
                    <Ticket className="w-3 h-3 inline ml-0.5 opacity-60" />
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
