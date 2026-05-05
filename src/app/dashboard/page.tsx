'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RestaurantRow {
  id: string
  name: string
  slug: string
  cover_image_url: string | null
  cuisine_tags: string[] | null
  order_count: number
  created_at: string
}

type ChipKey = 'all' | 'popular'

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'popular', label: 'Most Popular' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div
      className="bg-white overflow-hidden animate-pulse"
      style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="aspect-video bg-[var(--surface-3)]" />
      <div className="p-3.5 space-y-2">
        <div className="h-4 w-3/4 bg-[var(--surface-3)] rounded" />
        <div className="h-3 w-1/2 bg-[var(--surface-3)] rounded" />
      </div>
    </div>
  )
}

function RestaurantCard({ r }: { r: RestaurantRow }) {
  return (
    <Link
      href={`/${r.slug}/menu`}
      className="restaurant-card group block bg-white overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--red)] focus-visible:ring-offset-2"
      style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Cover image — 16:9 */}
      <div className="aspect-video relative overflow-hidden bg-[var(--surface-3)]">
        {r.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.cover_image_url}
            alt={r.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span
              className="text-5xl font-extrabold select-none"
              style={{ color: 'var(--border)' }}
            >
              {r.name[0].toUpperCase()}
            </span>
          </div>
        )}

        {/* Order count badge — bottom-left overlay */}
        {(r.order_count ?? 0) > 0 && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-black/55 backdrop-blur-sm text-white text-xs font-semibold px-2 py-1 rounded-full">
            <TrendingUp className="w-3 h-3 flex-shrink-0" />
            <span>{r.order_count.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="px-3.5 py-3 space-y-0.5">
        <h3 className="text-sm font-bold text-[var(--text-1)] leading-snug truncate">
          {r.name}
        </h3>
        {r.cuisine_tags && r.cuisine_tags.length > 0 && (
          <p className="text-xs text-[var(--text-3)] truncate">
            {r.cuisine_tags.join(' · ')}
          </p>
        )}
      </div>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser()

  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([])
  const [restaurantsLoading, setRestaurantsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeChip, setActiveChip] = useState<ChipKey>('all')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('restaurants')
      .select(
        'id, name, slug, cover_image_url, cuisine_tags, order_count, created_at'
      )
      .eq('is_active', true)
      .order('order_count', { ascending: false })
      .then(({ data }) => {
        setRestaurants((data as RestaurantRow[]) ?? [])
        setRestaurantsLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    let rows = [...restaurants]

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine_tags?.some((t) => t.toLowerCase().includes(q))
      )
    }

    rows.sort((a, b) => (b.order_count ?? 0) - (a.order_count ?? 0))

    return rows
  }, [restaurants, search, activeChip])

  const firstName = user?.full_name?.split(' ')[0] ?? null
  const greeting = getGreeting()

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="bg-[var(--red)] px-4 sm:px-6 lg:px-8 pt-10 pb-14">
        <div className="mx-auto max-w-7xl">
          {/* Greeting */}
          <div className="mb-7">
            {userLoading ? (
              <div className="h-9 w-64 bg-white/20 rounded-xl animate-pulse" />
            ) : (
              <h1 className="text-3xl font-bold text-white leading-tight">
                {greeting}{firstName ? `, ${firstName}` : ''} 👋
              </h1>
            )}
            <p className="mt-2 text-[15px] font-medium text-white/70">
              What are you eating today?
            </p>
          </div>

          {/* Search bar */}
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-[var(--text-3)] pointer-events-none" />
            <input
              type="search"
              placeholder="Search restaurants or cuisine…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white pl-11 pr-4 py-3.5 rounded-2xl text-sm font-medium text-[var(--text-1)] placeholder-[var(--text-3)] shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
            />
          </div>
        </div>
      </section>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 py-5">
          {CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setActiveChip(chip.key)}
              className={[
                'flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors',
                activeChip === chip.key
                  ? 'bg-[var(--red)] text-white'
                  : 'bg-[var(--surface-3)] text-[var(--text-2)] hover:bg-[var(--border)]',
              ].join(' ')}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Restaurant grid */}
        {restaurantsLoading ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 pb-10">
            {[...Array(6)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="p-10 text-center bg-white mb-10"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <p className="text-sm text-[var(--text-3)]">No restaurants found.</p>
            {search.trim() && (
              <button
                onClick={() => setSearch('')}
                className="mt-2 text-xs text-[var(--red)] hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 pb-10">
            {filtered.map((r) => (
              <RestaurantCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
