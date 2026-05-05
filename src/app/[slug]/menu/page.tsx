import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { MenuItem, Restaurant } from '@/types'
import { CartButton } from '@/components/cart/CartButton'
import { MenuLayoutShift } from '@/components/cart/MenuLayoutShift'
import { CategoryMenu } from './CategoryMenu'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase
    .from('restaurants')
    .select('name')
    .eq('slug', params.slug)
    .single()

  return { title: data ? `${data.name} — Menu` : 'Menu' }
}

export default async function MenuPage({ params }: Props) {
  const supabase = createClient()

  const [{ data: restaurant }, { data: userData }] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, slug, pricing_model, currency_label, ticket_eur_value, cover_image_url')
      .eq('slug', params.slug)
      .single(),
    supabase.auth.getUser(),
  ])

  if (!restaurant) notFound()

  const { data: items } = await supabase
    .from('menu_items')
    .select('id, name, description, image_url, price_eur, price_wallet_units, category')
    .eq('restaurant_id', restaurant.id)
    .eq('available', true)
    .is('deleted_at', null)
    .order('category')
    .order('name')

  const menuItems: MenuItem[] = items ?? []
  const isLoggedIn = !!userData.user
  const rest = restaurant as Restaurant

  const grouped = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const key = item.category ?? 'Other'
    acc[key] = [...(acc[key] ?? []), item]
    return acc
  }, {})
  const categories = Object.keys(grouped)

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--surface-2)]">

      {/* ── Hero banner ─────────────────────────────────────────────── */}
      <div className="relative h-44 sm:h-60 overflow-hidden bg-[var(--red)]">
        {rest.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={rest.cover_image_url}
            alt={rest.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: 'linear-gradient(135deg, var(--red) 0%, var(--red-dark) 100%)',
            }}
          />
        )}
        {/* Dark gradient overlay — stronger at bottom for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

        {/* Restaurant name overlaid at bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-5">
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            {rest.name}
          </h1>
          <p className="mt-1 text-sm text-white/60">Today&apos;s menu</p>
        </div>
      </div>

      {/* ── Login nudge ──────────────────────────────────────────────── */}
      {!isLoggedIn && (
        <div className="bg-[var(--red-light)] border-b border-[var(--red)]/20 px-4 py-3">
          <p className="text-sm text-[var(--red)] text-center">
            <Link
              href={`/login?next=/${params.slug}/menu`}
              className="font-semibold underline hover:opacity-80"
            >
              Log in
            </Link>
            {' '}or{' '}
            <Link
              href="/signup"
              className="font-semibold underline hover:opacity-80"
            >
              sign up
            </Link>
            {' '}to place an order.
          </p>
        </div>
      )}

      {/*
        MenuLayoutShift adds md:pr-[380px] when the cart sidebar is open,
        so both the category tabs and item list shift in sync with the sidebar.
        CartButton (mobile bar + desktop sidebar) lives outside so it isn't
        double-padded.
      */}
      <MenuLayoutShift restaurantId={rest.id}>
        <CategoryMenu
          grouped={grouped}
          categories={categories}
          ticketEurValue={rest.ticket_eur_value}
          restaurantId={rest.id}
          restaurantSlug={rest.slug}
        />
      </MenuLayoutShift>

      {/* CartButton renders the mobile cart bar + CartSidebar */}
      <CartButton restaurantId={rest.id} />
    </div>
  )
}
