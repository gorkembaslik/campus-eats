Implement category tabs and section headers on the menu page.

## What the DB now has
`menu_items.category` (text, nullable) is populated for all restaurants.

## Changes needed

### 1. `src/app/[slug]/menu/page.tsx`
Update the query — add `category`, order by it:
```ts
.select('id, name, description, image_url, price_eur, price_wallet_units, category')
.eq('restaurant_id', restaurant.id)
.eq('available', true)
.order('category')
.order('name')
```

Group items by category before rendering:
```ts
const grouped = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
  const key = item.category ?? 'Other'
  acc[key] = [...(acc[key] ?? []), item]
  return acc
}, {})
const categories = Object.keys(grouped)
```

Replace the existing placeholder tab bar + flat item list with `<CategoryMenu grouped={grouped} categories={categories} ... />` (pass through `currencyLabel`, `ticketEurValue`, `restaurantId`, `restaurantSlug`).

### 2. New file: `src/app/[slug]/menu/CategoryMenu.tsx` (client component)
Receives: `grouped`, `categories`, `currencyLabel`, `ticketEurValue`, `restaurantId`, `restaurantSlug`.

**Tab bar** — sticky, `top-16 z-30`, horizontally scrollable on mobile. One tab per category. Active tab: `text-[var(--red)]` + `bg-[var(--red)]` bottom underline. Inactive: `text-[var(--text-2)]`. Clicking a tab calls `scrollIntoView({ behavior: 'smooth', block: 'start' })` on the section. Use `IntersectionObserver` to highlight the tab whose section is currently in view.

**Item list** — for each category: a `div` with `id={category}`, a bold uppercase category header (`text-xs font-bold tracking-widest text-[var(--text-3)] uppercase`), then the `MenuCard` items in `space-y-3`. Keep `pb-28 md:pb-8` on the outer wrapper.

### 3. `src/types/index.ts`
Add `category?: string | null` to the `MenuItem` interface if not already there.

## Do NOT touch
`MenuCard.tsx`, `CartButton.tsx`, `MenuLayoutShift.tsx`, the hero banner, or the login nudge.
