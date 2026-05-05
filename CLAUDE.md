# CampusEats — Claude Code Project Guide

## Project Overview
A full-stack web app for university restaurant ordering. Students can browse menus, pay via digital wallet (tickets) or Stripe, and track orders in real time. Staff manage orders live; cashiers confirm pickups and credit wallets. Proposed to a real restaurant owner — must be production-grade and secure.

## Architecture
- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Database & Auth:** Supabase (PostgreSQL + RLS + Realtime)
- **Payments:** Stripe (PaymentIntent with `capture_method: manual`)
- **State:** Zustand v5
- **Toasts:** react-hot-toast
- **Icons:** lucide-react
- **Hosting:** Vercel

## Repository Structure
```
campus-eats/
├── src/
│   ├── app/
│   │   ├── (auth)/                  # login, signup pages + layout
│   │   ├── dashboard/               # restaurant discovery page + layout
│   │   │   ├── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── wallet/page.tsx      # wallet balances per restaurant; cards link to /{slug}/menu
│   │   ├── [slug]/menu/             # public menu page (NOTE: was /menu/[slug], changed in Phase 3)
│   │   │   ├── page.tsx             # server component; passes ticketEurValue to MenuCard
│   │   │   └── MenuCard.tsx         # menu item card; shows ticket label only when price_wallet_units > 0
│   │   ├── admin/
│   │   │   ├── page.tsx             # admin home (placeholder)
│   │   │   └── menu/page.tsx        # menu management (CRUD + availability toggle)
│   │   ├── cashier/
│   │   │   ├── layout.tsx           # min-h + surface-2 shell
│   │   │   ├── page.tsx             # server component: auth + role check + restaurant list → renders client
│   │   │   ├── CashierDashboardClient.tsx # 'use client'; Realtime subscription; fetches orders via API
│   │   │   └── OrderCard.tsx        # single order card with status pill + action buttons
│   │   ├── order/[orderId]/
│   │   │   ├── page.tsx             # order status page (server shell)
│   │   │   └── OrderStatusClient.tsx # real-time status + step indicator + pickup code
│   │   ├── api/
│   │   │   ├── orders/
│   │   │   │   ├── route.ts         # POST — create order, provision tickets, create Stripe intent
│   │   │   │   └── [orderId]/
│   │   │   │       ├── route.ts     # DELETE — customer cancel (delegates to lib/orders/cancel.ts)
│   │   │   │       └── authorize/route.ts # POST — primary Stripe confirm path (verify intent + pending)
│   │   │   ├── cashier/
│   │   │   │   └── orders/
│   │   │   │       ├── route.ts               # GET — active queue + today's history (service-role)
│   │   │   │       └── [orderId]/
│   │   │   │           ├── status/route.ts    # PATCH — pending→preparing→ready
│   │   │   │           ├── confirm/route.ts   # POST — capture-on-pickup (delegates to lib/orders/capture.ts)
│   │   │   │           └── cancel/route.ts    # POST — cashier cancel (delegates to lib/orders/cancel.ts)
│   │   │   ├── internal/
│   │   │   │   └── auto-resolve/route.ts # POST — cron target; auto-cancel pending + auto-complete ready
│   │   │   └── webhooks/
│   │   │       └── stripe/route.ts  # POST — Stripe webhook (signature verified; handles 4 event types)
│   │   └── unauthorized/page.tsx
│   ├── lib/
│   │   ├── supabase/                # client.ts / server.ts / middleware.ts
│   │   └── orders/
│   │       ├── cancel.ts            # shared cancel: void Stripe + release wallet + mark cancelled
│   │       └── capture.ts           # shared capture: Stripe capture + wallet debit + mark completed
│   ├── components/
│   │   ├── auth/
│   │   │   └── withRole.tsx         # HOC: redirects if role not in allowedRoles
│   │   ├── nav/
│   │   │   └── TopNav.tsx           # top nav; "Cashier" link shown when role=cashier|admin
│   │   └── cart/
│   │       ├── CartButton.tsx       # floating button (mobile) + mounts CartSidebar
│   │       ├── CartSidebar.tsx      # slide-in cart; resets on clearCart; cancel-on-back calls DELETE API
│   │       ├── MenuLayoutShift.tsx  # pushes menu content when desktop sidebar is open
│   │       ├── PaymentSelector.tsx  # single "Pay with Card" card + optional wallet checkbox; greedy preview
│   │       └── StripeCheckout.tsx   # Stripe Payment Element; calls onSuccess(orderId) instead of navigating
│   ├── hooks/
│   │   └── useUser.ts               # returns { user, role, loading } — use everywhere
│   ├── middleware.ts                # Route protection via Supabase session
│   ├── store/
│   │   └── cartStore.ts             # Zustand: items, restaurantId, paymentMethod; derived selectors
│   ├── styles/
│   │   └── tokens.css               # Design tokens (CSS variables) — import in globals.css
│   └── types/
│       └── index.ts                 # shared TS types and enums
├── .env.local                       # Never commit
└── CLAUDE.md
```

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY            ← server-side only, NEVER in client components
STRIPE_SECRET_KEY                    ← server-side only
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   ← used by StripeCheckout (client)
STRIPE_WEBHOOK_SECRET
CRON_SECRET                          ← any strong random string; set in both .env.local and pg_cron job
```
**Critical:** `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY` must only appear in `src/app/api/` route handlers.

**Local webhook testing:** run the Stripe CLI listener alongside `npm run dev`:
```
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
The CLI prints a temporary `whsec_...` secret — paste it into `.env.local` as `STRIPE_WEBHOOK_SECRET`.
To trigger test events: `stripe trigger payment_intent.succeeded`

`src/lib/supabase/server.ts` currently uses the anon key (cookie-based session) — the service role client is created inline in API routes only.

## Database Schema
All tables live in `public` schema and extend Supabase `auth.users`.

### Key Tables
| Table | Purpose |
|---|---|
| `users` | Extends auth.users; columns: full_name, role |
| `restaurants` | Multi-tenant core; holds pricing_model, currency_label, ticket_eur_value, is_active, order_count, cuisine_tags, cover_image_url |
| `wallet_accounts` | One per user per restaurant; balance **always in ticket units** |
| `wallet_transactions` | Audit log of every wallet movement (credit/debit/provision/release) |
| `menu_items` | Per restaurant; price_eur always set; price_wallet_units = 0 means auto-convert, > 0 means explicit ticket price |
| `orders` | Customer orders with status flow; carries idempotency_key (unique, nullable) |
| `order_items` | Line items with price snapshot + wallet_quantity / stripe_quantity attribution |
| `payments` | stripe_payment_intent_id, wallet_units_provisioned, stripe_amount_eur, status |

### Enums
```sql
user_role:        customer | cashier | admin
pricing_model:    monetary | ticket_count
transaction_type: credit | debit | provision | release
order_status:     awaiting_payment | pending | preparing | ready | completed | cancelled
payment_method:   wallet | stripe | mixed
payment_status:   pending | authorized | captured | released | failed
```

### Actual Column Names (verified against live DB)
| Table | Key columns |
|---|---|
| `orders` | id, restaurant_id, user_id, status, payment_method, idempotency_key, created_at, updated_at |
| `order_items` | id, order_id, menu_item_id, quantity, unit_price_eur, unit_price_wallet_units, wallet_quantity, stripe_quantity |
| `payments` | id, order_id, stripe_payment_intent_id, stripe_amount_eur, wallet_units_provisioned, wallet_units_captured, status, captured_at |
| `wallet_transactions` | id, wallet_id, cashier_id (nullable), type, amount, ticket_code, note, created_at |
| `wallet_accounts` | id, user_id, restaurant_id, balance, updated_at |
| `menu_items` | id, restaurant_id, name, description, image_url, price_eur, price_wallet_units, available, deleted_at |
| `restaurants` | id, name, slug, pricing_model, currency_label, ticket_eur_value, is_active, order_count, cuisine_tags, cover_image_url |

### Migrations Status
All migrations have been applied to the live DB. No pending migrations.

### Ticket Model (unified — applies to all restaurants)

**Wallets always hold ticket units**, never euros. The `pricing_model` column still exists in the DB but is **not used in any payment logic**.

Every item is ticket-eligible. The ticket cost per item is determined by `price_wallet_units`:

| `price_wallet_units` | Ticket cost charged | Menu display |
|---|---|---|
| `> 0` | Explicit restaurant-set price (e.g. €12 dish costs 1 ticket) | shown next to € price |
| `= 0` | Auto-converted: `price_eur / ticket_eur_value` | euro price only |

`ticket_eur_value` (e.g. 8.0) is used in **two** places:
1. **Payment calculation** — converting items with `price_wallet_units = 0` to their ticket cost
2. **Display** — showing the approximate EUR value of the wallet balance ("≈ €X")

### Critical Business Rules
1. `price_wallet_units = 0` means **auto-convert** — ticket cost = `price_eur / ticket_eur_value`. It does NOT mean card-only; all items are ticket-eligible.
2. `price_wallet_units > 0` means explicit student-rate ticket price — use directly, no conversion.
3. Effective ticket cost helper (used in API and MenuCard): `price_wallet_units > 0 ? price_wallet_units : price_eur / ticket_eur_value`
4. Payment attribution is item-level, not order-level: `wallet_quantity + stripe_quantity = quantity` for every order_items row
5. Mixed payment greedy: expand to individual units, sort by effective ticket cost ascending, assign each to wallet while `heldTickets + ticketCost ≤ balance`, else to card.
6. Price snapshots **must** be saved in `order_items` at order time — menu prices can change
7. Wallet top-ups can **only** be performed by cashiers, never by customers
8. Stripe uses `capture_method: manual` — intent is held on order, captured on pickup
9. Every wallet movement must create a `wallet_transactions` row — no exceptions
10. Wallet deduction is atomic: `.gte('balance', ticketsProv)` conditional update prevents double-spend races
11. Idempotency: duplicate submissions with the same `Idempotency-Key` header return the original `orderId` + `stripeClientSecret` without creating a new order

## Roles & Permissions
| Action | customer | cashier | admin |
|---|---|---|---|
| Browse menu | ✅ | ✅ | ✅ |
| Place order | ✅ | ❌ | ✅ |
| View own orders | ✅ | ❌ | ✅ |
| View all orders (live) | ❌ | ✅ | ✅ |
| Confirm pickup | ❌ | ✅ | ✅ |
| Credit wallet | ❌ | ✅ | ✅ |
| Edit menu | ❌ | ❌ | ✅ |
| View audit log | ❌ | ❌ | ✅ |
| Manage user roles | ❌ | ❌ | ✅ |

## RLS Policy Requirements
Every table has RLS enabled. Policies needed (not yet written as SQL migrations):

```sql
-- Public read for menu browsing
create policy "public_read" on public.restaurants for select using (true);
create policy "public_read" on public.menu_items   for select using (true);

-- Customers read own data
create policy "read_own" on public.orders         for select using (auth.uid() = user_id);
create policy "read_own" on public.order_items    for select using (
  exists (select 1 from orders where id = order_id and user_id = auth.uid())
);
create policy "read_own" on public.payments       for select using (
  exists (select 1 from orders where id = order_id and user_id = auth.uid())
);
create policy "read_own" on public.wallet_accounts     for select using (auth.uid() = user_id);
create policy "read_own" on public.wallet_transactions for select using (
  exists (select 1 from wallet_accounts where id = wallet_id and user_id = auth.uid())
);

-- Admin writes to menu_items (browser client — needs RLS, not service role)
-- ✅ Applied — includes WITH CHECK clause so INSERT/UPDATE are both guarded
create policy "admin_write" on public.menu_items
  for all
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- Staff read all orders (required for Supabase Realtime to deliver events to cashier dashboard)
-- ✅ Applied
create policy "staff_read_orders" on public.orders
  for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.users where id = auth.uid() and role in ('cashier', 'admin'))
  );
```
**After any policy or FK change:** run `notify pgrst, 'reload schema';`

**Note:** `POST /api/orders` uses the service-role client for all DB writes (bypasses RLS). Authorization is enforced explicitly in code: cashiers are blocked, ownership is verified before wallet operations.

## Supabase Client Rules
| Client | File | Key | Use for |
|---|---|---|---|
| Browser | `src/lib/supabase/client.ts` | anon | Components, hooks, client-side queries |
| Server | `src/lib/supabase/server.ts` | anon + cookies | Server components, page.tsx data fetches |
| Admin | inline in `src/app/api/` | service role | API routes only — bypasses RLS |

Never import the server client into a `'use client'` file. Never use the service role key outside `src/app/api/`.

## Shared Types (`src/types/index.ts`)
```ts
Role          = 'customer' | 'cashier' | 'admin'
PricingModel  = 'monetary' | 'ticket_count'
PaymentMethod = 'wallet' | 'stripe' | 'mixed'
OrderStatus   = 'awaiting_payment' | 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'

Restaurant, MenuItem, UserProfile, WalletAccount  // interfaces

// Added in Phase 4 — cashier dashboard
OrderItem      // id, quantity, unit_price_eur, unit_price_wallet_units, menu_items{name}
OrderPayment   // wallet_units_provisioned, stripe_amount_eur
CashierPayment // OrderPayment + stripe_payment_intent_id + status
CashierOrder   // id, status, payment_method, created_at, restaurant_id, user_id,
               // users{full_name}, order_items:OrderItem[], payments:CashierPayment[]
```
`WalletAccount.restaurants` includes `slug: string | null` — used by the wallet page to build `/{slug}/menu` links.

## Cart Store (`src/store/cartStore.ts`)
Zustand v5 store. State: `restaurantId`, `restaurantSlug`, `items[]`, `paymentMethod`.

- `addItem()` — enforces single-restaurant rule; calls `window.confirm` if switching restaurants
- `removeItem()` — filters to new array first; spreads `EMPTY_CART` when result is empty (preserves `paymentMethod`)
- `updateQuantity(id, 0)` — delegates to `removeItem`
- `clearCart()` — resets to EMPTY_CART

`CartItem.unitPriceWalletUnits` stores the **effective ticket cost** computed in `MenuCard` at add-item time: `price_wallet_units > 0 ? price_wallet_units : price_eur / ticketEurValue`. This means `selectNTickets` gives the correct total without needing `ticketEurValue` at read-time.

Derived selectors (plain functions, not store actions):
```ts
selectTotalEur(items)    // sum of unitPriceEur × qty
selectNTickets(items)    // sum of unitPriceWalletUnits × qty (effective ticket cost, all items)
selectItemCount(items)   // sum of all quantities
```

## Cart Sidebar Flow
`CartButton` (client island on menu page) → `CartSidebar` manages 4 view states:
```
'cart' → 'payment-selector' → 'submitting' (POST /api/orders) → 'stripe-checkout'
                                   ↓ wallet/mixed with no card charge
                            clearCart() → router.push(/order/[id])
```
- Entering `payment-selector` generates a fresh `crypto.randomUUID()` stored in a ref as the idempotency key
- Going back to `cart` clears the ref — next "Place Order" click generates a new key
- Going back from `stripe-checkout` calls `DELETE /api/orders/{orderId}` (best-effort cancel), clears idempotency ref, returns to `payment-selector`
- `clearCart()` is always called before `router.push` — both for wallet/mixed success and Stripe success
- A `useEffect` watching `items.length === 0` resets `view → 'cart'`, `stripeData → null`, idempotency ref (safety net)
- `PaymentSelector` receives `totalEur`, `nTickets`, `cardOnlyEur`, `items` props. It fetches the ticket balance itself (reads `restaurantId` from store).
- `StripeCheckout` uses `@stripe/stripe-js` (no react-stripe-js) with manual DOM mount via `useRef`; calls `onSuccess(orderId)` instead of navigating directly.

## PaymentSelector Props & Logic
```ts
Props: { totalEur, nTickets, cardOnlyEur, items: CartItem[], onConfirm }
// nTickets    — total ticket units for all items (effective cost pre-computed in cart)
// cardOnlyEur — always 0 in the unified model (all items are ticket-eligible)
// items       — full cart items for accurate client-side greedy preview
```
UI: single "Pay with Card" card. Checkbox "Use wallet balance" shown only if `ticketBal > 0 && nTickets > 0`. Checkbox defaults to checked when applicable.

Method resolves:
- `useWallet && hasBalance && hasTicketItems && walletCoversAll` → `'wallet'`
- `useWallet && hasBalance && hasTicketItems && !walletCoversAll` → `'mixed'`
- otherwise → `'stripe'`

`computeMixedSplit(items, balance)` mirrors the server greedy: expand to units, sort by `ticketPrice` (= `unitPriceWalletUnits`) asc, assign to wallet while balance allows (guarding `ticketPrice > 0`), else assign card charge at `item.unitPriceEur`. **Never uses `ticket_eur_value` for card calculations.**

`buildBreakdown()` generates a human-readable charge summary per method shown beneath the checkbox.

## POST /api/orders — Key Behaviours
- Auth via cookie-based client; all DB writes via service-role client
- Fetches current DB prices **and `ticket_eur_value`** — client-submitted prices are **ignored**
- Idempotency: reads `Idempotency-Key` header (UUID); if a matching `(key, user_id)` row exists, returns original `orderId` + retrieves `stripeClientSecret` from Stripe — no new order created
- `getEffectiveTicketCost(price_wallet_units, price_eur, ticketEurValue)` computes ticket cost per item server-side (mirrors client logic)
- All items are ticket-eligible; greedy assigns cheapest (by effective ticket cost) to wallet first, rest to card
- `wallet_quantity` + `stripe_quantity` written to each `order_items` row
- Ticket deduction uses conditional update: `.gte('balance', ticketsProv)` to prevent race conditions
- Rollback tracked via `RollbackState` (`ticketsHeld`, `ticketsHeldAmt`, `ticketAccId`); cleanup runs in reverse insert order
- Stripe minimum: 50 cents — returns 400 if card amount < €0.50
- Returns: `{ orderId, stripeClientSecret? }`

## Order Status Page (`/order/[orderId]`)
- Server component fetches order with joins: `orders → order_items → menu_items`, `payments`
- `export const dynamic = 'force-dynamic'` required (reads `searchParams` for Stripe redirect)
- `OrderStatusClient` subscribes to Supabase Realtime on `orders` filtered by `id=eq.{orderId}`
- Realtime requires `orders` table added to the `supabase_realtime` publication
- Ready banner is `sticky top-0` and shows when `status === 'ready'`
- `awaiting_payment` shown as a "Confirming payment…" spinner (step 0, before the normal stepper)
- `canCancel` prop: `true` when `order.user_id === user.id && order.status === 'pending'`; shows a cancel button that calls `DELETE /api/orders/[orderId]` with a confirm dialog
- `document.visibilitychange` listener refetches order from DB when tab is re-focused (guards against Realtime gaps when tab was backgrounded)
- 3DS redirect handling: server component detects `?redirect_status=succeeded` + `order.status === 'awaiting_payment'`, verifies with Stripe, moves order to `pending` server-side, re-fetches and renders updated state

## Admin Menu Page (`/admin/menu`)
- Wrapped with `withRole(['admin'])`
- Fetches `restaurants` (first row, selects `id, name, currency_label`) + `menu_items` (excludes `deleted_at IS NOT NULL`) on mount
- Optimistic availability toggle with `useRef<Set<string>>` to debounce rapid clicks
- Upsert: `.upsert(payload, { onConflict: 'id' })` — handles create and edit in one call
- **Ticket equivalent field**: `0` = auto from € price (default), `> 0` = explicit student-rate ticket price, must be multiple of 0.5
- Validation: `wallet < 0` is the only invalid case; `0` is valid and encouraged
- Form is a bottom-sheet modal on mobile, centered dialog on desktop
- **Soft-delete**: delete sets `deleted_at = now()` instead of hard-deleting, preserving price snapshots in `order_items`. Filter `.is('deleted_at', null)` applied in both the admin fetch and the public `/[slug]/menu` query.
- **Delete button**: trash icon (`aria-label="Delete item"`) in modal footer, visible only when editing. Shows `window.confirm` before soft-deleting. Toast: `'Item deleted.'`
- **RLS**: `admin_write` policy (FOR ALL with USING + WITH CHECK) applied to `menu_items`. Browser client (anon key + session) can INSERT/UPDATE/DELETE only if `users.role = 'admin'`.

## Ordering & Payment Flow
```
Customer places order (POST /api/orders)
  → idempotency check — duplicate key returns existing order, no writes
  → prices + ticket_eur_value re-fetched from DB (tamper prevention)
  → effective ticket cost = price_wallet_units > 0 ? explicit : price_eur / ticket_eur_value
  → item-level greedy attribution: cheapest-ticket items → wallet, rest → Stripe
  → ticket balance checked; provision inserted; balance deducted atomically (.gte guard)
  → AND/OR Stripe PaymentIntent created (capture_method: manual)
  → order status:
      'pending'           — wallet-only orders (no card, visible to cashier immediately)
      'awaiting_payment'  — card/mixed orders (hidden from cashier queue until payment confirmed)

  Card/mixed path — Stripe payment confirmation (primary path):
  → StripeCheckout calls POST /api/orders/[orderId]/authorize after confirmPayment()
  → authorize route verifies intent status directly with Stripe (requires_capture or succeeded)
  → updates orders.status → 'pending', payments.status → 'authorized'
  → StripeCheckout calls onSuccess(orderId) → navigate to /order/[orderId]

  Card/mixed path — 3DS redirect fallback:
  → Stripe redirects back to /order/[orderId]?redirect_status=succeeded
  → page.tsx server component detects awaiting_payment + redirect_status=succeeded
  → same authorize logic runs server-side; order rendered as 'pending' immediately

  Stripe webhook — secondary fallback:
  → payment_intent.amount_capturable_updated → same awaiting_payment→pending transition
  → payment_intent.canceled / payment_failed → cancel_order + release wallet
  → payment_intent.succeeded (post-capture) → mark payments.status='captured'

Staff sees order in real time (Supabase Realtime)
  → cashier queue subscribes to orders with status IN ('pending','preparing','ready')
  → awaiting_payment orders are invisible until confirmed — avoids Realtime timing race
  → updates status: 'preparing' → 'ready'

Customer picks up at cashier
  → cashier confirms pickup (POST /api/cashier/orders/[id]/confirm)
  → wallet: debit transaction inserted + balance finalised
  → Stripe: PaymentIntent captured
  → order status: 'completed'

Auto-resolve via pg_cron (every minute) → POST /api/internal/auto-resolve
  awaiting_payment + pending timeout (5 min, no action):
  → wallet provision released (transaction type: 'release'); balance restored
  → Stripe PaymentIntent voided
  → order status: 'cancelled'  (payment not confirmed or kitchen never started — full refund)

  Ready timeout (15 min, student no-show):
  → Stripe PaymentIntent captured (charge kept)
  → wallet debit finalised
  → order status: 'completed'  (food was made — no refund)
```

**Cancellation policy by stage:**
| Order stage | Customer cancels | No-show timeout |
|---|---|---|
| `awaiting_payment` | Full refund (DELETE /api/orders/[id]) | 5 min → auto-cancel (full refund) |
| `pending` | Full refund (cancel button on /order/[id]) | 5 min → auto-cancel (full refund) |
| `preparing` | Blocked (API returns 409) | — cashier manages manually |
| `ready` | Blocked | 15 min → auto-complete (charge kept) |

## Design System
Tokens live in `src/styles/tokens.css` (imported in `globals.css`). Always use these CSS variables — never hardcode colours, radii, or shadows.

```css
/* Brand */
--red: #FF3008;  --red-dark: #CC2600;  --red-light: #FFF0EE;

/* Surfaces */
--surface: #FFFFFF;  --surface-2: #F6F6F6;  --surface-3: #EEEEEE;

/* Text */
--text-1: #191919;  --text-2: #545454;  --text-3: #929292;

/* Border / Semantic */
--border: #E0E0E0;  --success: #038C4C;

/* Radius */
--radius-sm: 8px;  --radius-md: 16px;  --radius-lg: 24px;

/* Shadows */
--shadow-sm: 0 1px 4px rgba(0,0,0,0.08);
--shadow-md: 0 4px 16px rgba(0,0,0,0.12);
--shadow-lg: 0 8px 32px rgba(0,0,0,0.16);
```

Font: **DM Sans** (400, 500, 600, 700). Reference aesthetic: DoorDash. Mobile-first, card-based layouts.

## Coding Conventions
- All TypeScript — no `any` types
- `decimal(10,2)` for all monetary values; display with `.toFixed(2)`
- Always show `currency_label` from restaurant — never hardcode `$`, `€`, or "tickets"
- `react-hot-toast` for all user feedback
- Mobile-first Tailwind — most users are on phones
- PostgREST joins: `.select('*, restaurants(name, currency_label)')`
- Price snapshots in `order_items` at order creation — mandatory

## Common Pitfalls (Already Hit)
1. **RLS blocks PostgREST joins** — if a joined table has no SELECT policy, join returns `null`. Always add policies to reference tables.
2. **PostgREST schema cache** — after any FK or policy change: `notify pgrst, 'reload schema';`
3. **service_role key** — only in `src/app/api/` route handlers; never in components
4. **Balance display** — always join `wallet_accounts` with `restaurants` for `currency_label`
5. **Stripe status after manual capture** — confirmed intents land in `requires_capture`, not `succeeded`
6. **Realtime filter requires publication** — `orders` table must be in `supabase_realtime` publication for row-level filters to work
7. **next/image external domains** — add Supabase Storage hostname to `next.config.js` `remotePatterns` when menu item images are hosted there
8. **`export const dynamic = 'force-dynamic'`** — required on any page.tsx that reads `searchParams`
9. **`price_wallet_units = 0` means auto-convert, not card-only** — ticket cost = `price_eur / ticket_eur_value`. The greedy guards `ticketPrice > 0` to skip genuinely free items, but `0` in the DB always triggers conversion.
10. **`ticket_eur_value` is used in payment calculations** — the API route and MenuCard both use it to convert items with `price_wallet_units = 0`. Don't skip fetching it. Guard against `ticket_eur_value = 0` (division by zero).
11. **DB column names differ from original CLAUDE.md** — always use the "Actual Column Names" table above. The original doc had `price_eur`/`price_wallet_units` on `order_items` (wrong); actual names are `unit_price_eur`/`unit_price_wallet_units`. `wallet_transactions.wallet_id` not `wallet_account_id`; `cashier_id` was NOT NULL (now dropped).
12. **Mixed card amount must use item EUR prices** — the client-side greedy preview (and server-side calculation) assigns card charge as `item.unitPriceEur × qty`, never as `ticketShortfall × ticket_eur_value`. Using face-value conversion gives wrong totals.
13. **Cart must be cleared before navigating away** — `clearCart()` must be called before `router.push('/order/...')` in all payment paths; if navigation happens first, the Zustand store persists and the cart reopens when the user returns to the restaurant page.
14. **`CartItem.unitPriceWalletUnits` is the effective ticket cost** — computed in `MenuCard` at add-item time (`price_wallet_units > 0 ? explicit : price_eur / ticketEurValue`). Never store the raw `price_wallet_units = 0` value from the DB into the cart; that would make `selectNTickets` return 0 for conversion items.
15. **`pricing_model` column is not used in payment logic** — it exists in the DB but all restaurants use the same unified ticket model. Do not branch on it for calculations or display.
16. **`getSession()` is insecure on the server** — it reads cookies without Auth-server verification. Always use `getUser()` in server components and API routes. `getSession()` is acceptable only in `'use client'` files alongside `onAuthStateChange`.
17. **Stripe 3DS test needs a long timeout** — the 3DS flow (page load + card fill + Stripe processing + modal wait + redirect) can take 60–80s. Set `test.setTimeout(120_000)` on the individual Playwright test; the global 45s limit will otherwise cut `waitForURL` short.
18. **Stripe 3DS redirect race** — call `waitForURL` and `completeBtn.click()` inside `Promise.all()`; if you `await click()` first, the redirect can fire before `waitForURL` starts listening and the navigation is missed.
19. **Stripe 3DS iframe click must use `frame.evaluate()`** — Playwright's synthetic `click()` sends pointer events that are silently dropped by cross-origin sandboxed iframes (the nested Stripe 3DS test page). Use `challengeFrame.evaluate(() => btn?.click())` instead, which executes directly in the frame's JS context via CDP and reliably triggers the event listeners. Find `challengeFrame` by iterating `page.frames()` (all frames including nested) and checking `locator('button:has-text("Complete")').isVisible()`. Do NOT use chained `frameLocator('iframe').first()` — it picks Payment Element iframes, not the 3DS overlay.
20. **Realtime INSERT fires before joined rows exist** — Supabase Realtime publishes the `orders` INSERT event immediately, but the `payments` INSERT hasn't happened yet. Any filter on a joined table's columns (e.g. `order.payments[0]?.status !== 'pending'`) will see an empty `payments` array and evaluate incorrectly. Gate visibility purely on columns of the `orders` row itself (e.g. `status = 'awaiting_payment'` is written atomically with the order INSERT and is immediately correct).
21. **`authorized` is a required payment_status for wallet orders** — wallet orders never go through Stripe, so their `payments.status` is set to `'authorized'` at creation time (not `'pending'`). This distinguishes "wallet payment confirmed" from "Stripe payment not yet confirmed". The auto-resolve and cashier confirm routes check this status when deciding whether capture is safe.

## E2E Testing (Playwright)

Test suite lives in `e2e/`. Run with `npm run test:e2e` (headless) or `npm run test:e2e:ui` (interactive).

### Setup
- Config: `playwright.config.ts` (project root) — base URL `http://localhost:3000`, auto-starts `npm run dev`
- Auth: `e2e/global.setup.ts` logs in once and saves cookies to `e2e/.auth/customer.json` (gitignored)
- Credentials: `.env.test` (gitignored) — `TEST_CUSTOMER_EMAIL` / `TEST_CUSTOMER_PASSWORD` + `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`
- Test user must have **≥ 1 ticket balance at dahlia-oven** for the wallet-order test
- dotenv loaded in `playwright.config.ts` so env vars are available to the setup script

### Playwright projects
- `setup` — customer login, runs before `chromium`
- `chromium` — customer specs; `testIgnore: /admin/` prevents admin specs from running under the customer session
- `admin-setup` — admin login, runs before `admin`
- `admin` — admin specs only (`testMatch: /admin-menu\.spec\.ts/`)

### Test files
| File | What it covers |
|---|---|
| `e2e/global.setup.ts` | Customer auth once; saves storageState to `e2e/.auth/customer.json` |
| `e2e/admin.setup.ts` | Admin auth once; saves storageState to `e2e/.auth/admin.json` |
| `e2e/menu.spec.ts` | Dahlia Oven + Shalimar menu load, prices, category tabs |
| `e2e/cart.spec.ts` | Add / increment / decrement / remove item; Place Order; Back |
| `e2e/order-wallet.spec.ts` | Full wallet-only order at Dahlia Oven (Margherita = 1 ticket) |
| `e2e/order-stripe.spec.ts` | Full Stripe card order (test card `4242 4242 4242 4242`) |
| `e2e/order-stripe-3ds.spec.ts` | Stripe 3DS challenge flow (test card `4000 0025 0000 3155`) |
| `e2e/admin-menu.spec.ts` | Admin CRUD: page load, create item, edit item, toggle availability, delete item |

### Key patterns
- Desktop viewport (1280×800) so cart sidebar auto-expands — avoids mobile sticky-bar ambiguity
- `fullyParallel: false` to prevent DB race conditions between order tests
- `afterEach` in order tests calls `DELETE /api/orders/{orderId}` to clean up created orders
- Scope quantity buttons to the sidebar: `sidebar.getByRole('button', { name: 'Add one more' })` — menu cards have the same buttons
- 3DS test uses `test.setTimeout(120_000)` and `Promise.all([page.waitForURL(...), challengeFrame.evaluate(...)])` — see pitfall #19
- Admin tests use `getByPlaceholder` (not `getByLabel`) because the `Field` component has no `htmlFor`
- Admin `gotoAdminMenu` waits for `getByRole('button', { name: /^Edit /i }).first()` before interacting — confirms restaurant data loaded (the `handleSave` guard needs it)
- Admin toast assertions use `{ timeout: 15_000 }` — Supabase round-trips can exceed Playwright's 5s default

## Development Phases
- [x] Phase 1 — Project scaffold, DB schema, env setup
- [x] Phase 2 — Auth, user profiles, role-based routing, wallet display
- [x] Phase 3 — Menu display, cart, ordering flow, Stripe provision, order status page
  - [x] Menu page with hero banner, sticky category tab, MenuCard
  - [x] Cart sidebar (4 views: cart / payment-selector / submitting / stripe-checkout)
  - [x] PaymentSelector (single card + wallet checkbox, accurate greedy preview)
  - [x] StripeCheckout (manual DOM mount, onSuccess callback)
  - [x] POST /api/orders (idempotency, greedy attribution, atomic wallet deduction, rollback)
  - [x] DELETE /api/orders/[orderId] (cancel-on-back: void Stripe intent, release provision)
  - [x] Order status page with Realtime subscription
  - [x] TopNav avatar dropdown (wallet + logout; no wallet chip)
  - [x] Wallet page clickable cards (link to /{slug}/menu)
  - [x] End-to-end testing (Playwright: menu, cart, wallet order, Stripe card, Stripe 3DS — 13/13 passing)
- [x] Phase 3.5 — Unified ticket model refactor
  - [x] DB migration: Shalimar price_wallet_units reset to 0; wallet balances converted EUR→tickets
  - [x] API route: getEffectiveTicketCost helper; fetches ticket_eur_value; greedy uses conversion
  - [x] MenuCard: ticketEurValue prop; shows ticket label only for explicit prices; effective cost stored in cart
  - [x] CartSidebar: removed pricing_model dependency; showTicketBreakdown for all restaurants
  - [x] Admin form: ticket equivalent field (0 = auto-convert); validation fixed
- [x] Phase 3.6 — Admin menu management: soft-delete + E2E tests
  - [x] DB migration: `menu_items.deleted_at TIMESTAMPTZ DEFAULT NULL` + index
  - [x] RLS: `admin_write` policy applied (FOR ALL, USING + WITH CHECK on `users.role = 'admin'`)
  - [x] Soft-delete: `handleDelete` sets `deleted_at`; `.is('deleted_at', null)` filter in admin fetch and public menu query
  - [x] Delete button: trash icon in modal footer, shown only when editing, with `window.confirm` guard
  - [x] Admin Playwright project: `admin-setup` + `admin` projects; `testIgnore: /admin/` on customer project
  - [x] E2E tests: `e2e/admin.setup.ts` + `e2e/admin-menu.spec.ts` (5 tests: load, create, edit, toggle, delete)
  - [x] Full suite: 18/18 passing (13 customer + 5 admin)
- [x] Phase 4 — Staff & cashier dashboard, Supabase Realtime order management
  - [x] `GET /api/cashier/orders` — live queue + today's history (service-role, role-checked)
  - [x] `PATCH /api/cashier/orders/[id]/status` — pending→preparing→ready
  - [x] `POST /api/cashier/orders/[id]/confirm` — capture-on-pickup (Stripe capture + wallet debit)
  - [x] `POST /api/cashier/orders/[id]/cancel` — cashier cancel (any pending/preparing order)
  - [x] `POST /api/webhooks/stripe` — signature-verified webhook (4 event types, idempotent)
  - [x] `/cashier` dashboard — server role-guard + `CashierDashboardClient` (Realtime) + `OrderCard`
  - [x] Pickup code on customer `/order/[id]` page (last 6 chars of UUID, uppercased)
  - [x] TopNav: "Cashier" link shown for cashier + admin roles
  - [x] `src/lib/orders/cancel.ts` + `capture.ts` — shared helpers (no duplication)
- [x] Phase 5 — Order lifecycle, payment confirmation, customer cancel, auto-resolve
  - [x] `awaiting_payment` order status — card/mixed orders invisible to cashier until Stripe confirms
  - [x] `authorized` payment status — wallet orders set at creation; card orders set by authorize route
  - [x] DB migration: `orders.updated_at` column + auto-update trigger (used for ready-timeout)
  - [x] DB migration: `order_status` enum extended with `awaiting_payment`
  - [x] DB migration: `payment_status` enum extended with `authorized`
  - [x] `POST /api/orders/[orderId]/authorize` — primary payment confirmation path
    - Called synchronously by StripeCheckout after `confirmPayment()` returns `requires_capture`
    - Verifies intent directly with Stripe; moves order `awaiting_payment` → `pending`
    - Idempotent (returns ok if already past `awaiting_payment`)
    - Webhook is fallback if this call fails
  - [x] 3DS redirect handling in `order/[orderId]/page.tsx` — server-side authorize for redirect path
  - [x] Customer cancel button on `/order/[orderId]` (shown only when `status === 'pending'`)
    - Calls `DELETE /api/orders/[orderId]`; Realtime subscription updates status to `cancelled`
  - [x] `document.visibilitychange` refetch in `OrderStatusClient` and `CashierDashboardClient`
  - [x] `POST /api/internal/auto-resolve` — cron target (Bearer CRON_SECRET auth)
    - `awaiting_payment` + `pending` orders > 5 min → `cancelOrder()` (full refund)
    - `ready` orders > 15 min (updated_at) → `captureOrder()` (charge kept; food was made)
  - [x] pg_cron schedule: every minute via `pg_net.http_post` to the route
  - [x] `captureOrder()` cashierId made optional (auto-complete has no human cashier)
  - [x] RLS fix: `staff_read_orders` policy on `orders` (enables Realtime for cashier dashboard)
  - [ ] **After Vercel deploy:** update the pg_cron job URL and CRON_SECRET (see below)
  - [x] Cashier wallet credit UI (QR scan + manual UUID + denomination basket + idempotent POST)
  - [x] Customer wallet transaction history page (`/dashboard/wallet/[restaurantId]`) + QR code display
  - [x] Admin audit log (`/admin/audit`) — grouped by cashier or flat list, date/restaurant/cashier filters
  - [x] Admin user role management page (`/admin/users`) — optimistic updates, last-admin guard
  - [x] Customer order history page (`/dashboard/orders`) — paginated, links to `/order/[id]`
  - [x] Admin home redesigned with nav cards (Menu, Audit, Users)
  - [x] TopNav: "Order history" and "Admin" links added
  - [x] DB migration: `ticket_denominations` JSONB on restaurants + `credit_wallet` RPC

**Updating the pg_cron job after Vercel deploy:**
```sql
-- Run once in Supabase SQL editor after deploying
SELECT cron.unschedule('auto-resolve-orders');
SELECT cron.schedule(
  'auto-resolve-orders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://YOUR-APP.vercel.app/api/internal/auto-resolve',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
```
Also add `CRON_SECRET=YOUR_CRON_SECRET` to Vercel environment variables.

**Local testing of auto-resolve (pg_cron can't reach localhost):**
```
curl -X POST http://localhost:3000/api/internal/auto-resolve \
  -H "Authorization: Bearer dev-cron-secret-replace-in-prod" \
  -H "Content-Type: application/json"
```
- [ ] Phase 6 — Polish, mobile UI, deploy to Vercel

## Seeded Restaurants

**Shalimar**
```
slug:             shalimar
pricing_model:    monetary   (DB legacy; not used in logic)
currency_label:   €
ticket_eur_value: 8.0
menu items:       85 (full menu — antipasti, zuppe, tandoori, mains, veg, rice, bread)
  All items have price_wallet_units = 0 → auto-converted at checkout (price_eur / 8.0)
  e.g. €9 Chicken Tikka Masala = 1.125 tickets
wallet balance:   stored in ticket units (migrated from EUR — 1 former € = 0.125 tickets)
```

**Dahlia Oven**
```
slug:             dahlia-oven
pricing_model:    monetary   (DB legacy; not used in logic)
currency_label:   €
ticket_eur_value: 8.0
menu items:       ~60 (pizzas, antipasti, pasta, secondi, desserts, drinks, wine, beer)
  Margherita      €9.50  → 1 ticket   (explicit price_wallet_units)
  All other items         → auto-converted at checkout (price_eur / 8.0)
  e.g. €12 pizza = 1.5 tickets
```

## When to Use --think Flag
Use `claude --model claude-sonnet-4-6 --think` for:
- Stripe PaymentIntent + manual capture logic
- Atomic wallet transaction + order creation (race conditions)
- RLS policy debugging
- Supabase Realtime subscription setup
- Any bug that wasn't fixed on the first attempt

Use `claude --model claude-opus-4-6 --think` for:
- Security architecture decisions
- Complex business logic (mixed payment flows, provision edge cases)
- Anything involving real money movement
