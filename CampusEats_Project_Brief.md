# CampusEats — Project Brief
*Last updated: Phase 3 in progress*

---

## 1. Project Overview

CampusEats is a web-based food ordering platform built to replace a WhatsApp-based ordering system used by a restaurant near a university residence. The app is being proposed to the restaurant owner as a turnkey solution. It must be production-grade, secure, and scalable to support multiple restaurants in the future.

**Core problem being solved:** Restaurant staff miss orders in a WhatsApp group, students don't know when their order is being prepared, and paper ticket handling is slow and error-prone.

**Core solution:** A digital ordering platform with a wallet system that converts physical meal tickets into digital balance, a pre-authorization (provision) payment flow to prevent order abandonment, and a real-time staff dashboard.

---

## 2. Tech Stack & Why

| Layer | Technology | Rationale |
|---|---|---|
| Frontend & Backend | Next.js 14 (App Router, TypeScript) | Full-stack in one repo, fast, great for both customer and staff views |
| Database & Auth | Supabase (PostgreSQL + RLS + Realtime) | Built-in auth, row-level security, real-time subscriptions, generous free tier |
| Payments | Stripe (PaymentIntent, manual capture) | Native support for pre-authorization/capture flow |
| State Management | Zustand | Lightweight, simple cart state |
| Styling | Tailwind CSS + DM Sans font | Fast to build, mobile-first |
| Hosting | Vercel | Free tier, native Next.js support |
| Icons | lucide-react | Clean, consistent icon set |
| Toasts | react-hot-toast | Simple user feedback |

---

## 3. Key Architectural Decisions

### 3.1 Multi-Tenant from Day One
The database is built around a `restaurants` table as the core tenant unit. Every wallet, menu item, and order belongs to a restaurant. This makes scaling to additional restaurants straightforward without schema changes.

### 3.2 Dual Pricing Model
Restaurants choose one of two pricing models at setup — this is stored on the `restaurants` table and never changes per order:
- `monetary` → wallet balance is in € (decimal)
- `ticket_count` → wallet balance is in ticket units (0.5 steps: 0.5 = half ticket, 1.0 = full ticket)

The field `currency_label` (e.g. "€" or "tickets") drives all UI display. No hardcoded currency symbols anywhere in frontend code.

**Ticket conversion rate:** 1 full ticket = €8.00, stored as `ticket_eur_value` on `restaurants`. Used for mixed payment calculations and display.

### 3.3 Digital Wallet System
Physical meal tickets (paper receipts from POS tap) can be loaded into a digital wallet by a cashier. The cashier reads the ticket code (e.g. `[1],[4]` = full ticket, `[1],[1]` = half ticket), determines the value, and manually credits the user's wallet. This is a deliberate UX decision — cashiers are the only trust boundary for crediting wallets. Customers can never credit their own wallet.

### 3.4 Payment Pre-Authorization (Provision Flow)
To prevent order abandonment (ordering food and not picking it up), payments are held — not charged — at order time:
- **Wallet payments:** balance is provisioned (reserved) via a `wallet_transactions` row of type `provision`. Balance is visually deducted but flagged as held.
- **Stripe payments:** a `PaymentIntent` is created with `capture_method: 'manual'`. The charge is held on the card but not settled.
- **Cashier confirms pickup → payment finalizes.** If no pickup, provision is released automatically after a timeout.

### 3.5 Role-Based Access (Three Roles)
| Role | Key Permissions |
|---|---|
| `customer` | Browse menu, place orders, view own wallet and order history |
| `cashier` | Credit wallets, confirm pickups, view live order queue |
| `admin` | Everything above + edit menu, view audit log, manage roles |

Enforced at three levels: Supabase RLS policies, Next.js middleware, and `withRole()` HOC on page components.

### 3.6 Price Snapshots on Order Items
`order_items` stores `unit_price_eur` and `unit_price_wallet_units` at the time of ordering. This means menu price changes never retroactively affect past orders, and prevents client-side price tampering (server re-fetches prices from DB and validates before creating the order).

### 3.7 Routing Structure
- `/dashboard` — restaurant discovery page (not wallet display)
- `/[slug]/menu` — restaurant menu page (not `/menu/[slug]`)
- `/dashboard/wallet` — wallet balances per restaurant
- `/cashier` — cashier panel
- `/admin` — admin panel
- `/order/[orderId]` — real-time order status

### 3.8 DoorDash Visual Design System
The app is designed to match DoorDash's aesthetic as a reference. Design tokens defined in `src/styles/tokens.css`:
- Primary: `#FF3008` (DoorDash red)
- Font: DM Sans (400, 500, 600, 700)
- Surfaces, borders, shadows all tokenized via CSS variables
- Mobile-first, card-based layouts

---

## 4. Database Schema

```sql
-- Enums
user_role:        customer | cashier | admin
pricing_model:    monetary | ticket_count
transaction_type: credit | debit | provision | release
order_status:     pending | preparing | ready | completed | cancelled
payment_method:   wallet | stripe | mixed
payment_status:   pending | captured | released | failed

-- Tables
users                  -- extends auth.users; stores full_name and role
restaurants            -- core tenant; pricing_model, currency_label, ticket_eur_value,
                       -- is_active, order_count, cuisine_tags, cover_image_url
wallet_accounts        -- one per user per restaurant; balance (meaning depends on pricing_model)
wallet_transactions    -- full audit log; type drives debit/credit direction
menu_items             -- per restaurant; price_eur + price_wallet_units; snapshots at order time
orders                 -- status flow; payment_method
order_items            -- line items with price snapshots
payments               -- Stripe intent ID + wallet provision tracking
```

**Critical constraints:**
- `wallet_accounts.balance` has a `CHECK (balance >= 0)` constraint — can never go negative
- `wallet_accounts` has a `UNIQUE(user_id, restaurant_id)` constraint — one wallet per restaurant per user
- `payments.order_id` is unique — one payment record per order

---

## 5. Bugs Discovered & How They Were Resolved

### Bug 1 — Duplicate Email Signup Shows No Error
**Cause:** Supabase email confirmation was enabled. Signing up with a duplicate email triggered "check your email" silently instead of an error.
**Fix:** Disabled email confirmation in Supabase Auth settings (re-enable for production). Added explicit frontend check: if `data.user` exists but `data.session` is null after `signUp()`, show "account already exists" toast and redirect to `/login`.

### Bug 2 & 3 — /admin and /cashier Return 404
**Cause:** Claude Code never created page files for those routes.
**Fix:** Created placeholder pages wrapped with `withRole()` guard.

### Bug 4A — Wallet Shows "$" Instead of "tickets"
**Cause:** Hardcoded `$` symbol in the dashboard component instead of reading `currency_label` from the `restaurants` table.
**Fix:** Joined `wallet_accounts` with `restaurants` in the query to get `currency_label` and display it dynamically.

### Bug 4B — Balance Shows "0.04" Instead of "3.50"
**Cause:** Balance was being divided or multiplied somewhere incorrectly in the display logic.
**Fix:** Rendered balance directly with `balance.toFixed(2)` — no arithmetic applied to the raw value.

### Bug 5 — Restaurant Name Shows as "Restaurant" in Dashboard
**Cause:** PostgREST join on `wallet_accounts → restaurants` was returning `null` for the restaurant object even though the FK existed in the data.
**Root cause (two-part):**
1. The FK constraint `wallet_accounts.restaurant_id → restaurants.id` was not formally declared in the schema, so PostgREST couldn't resolve the join.
2. Even after adding the FK, the PostgREST schema cache was stale.
3. Even after cache reload, the RLS policy on `restaurants` was missing — PostgREST silently returns `null` for joined rows when the referenced table has RLS enabled but no permissive `SELECT` policy.
**Fix sequence:**
- Added FK constraint via `ALTER TABLE`
- Ran `notify pgrst, 'reload schema';`
- Added `create policy "restaurants_public_read" on public.restaurants for select using (true);`

**Key lesson learned:** RLS blocks PostgREST joins silently. Always add `SELECT` policies to every table including reference/lookup tables. Always run `notify pgrst, 'reload schema'` after schema or policy changes.

---

## 6. RLS Policy Rules

Every table has RLS enabled. Policies applied so far:

| Table | Policy | Rule |
|---|---|---|
| `users` | `users_read_own` | Users read only their own row |
| `restaurants` | `restaurants_public_read` | Anyone can read (required for joins) |
| `wallet_accounts` | `wallet_read_own` | Users see only their own wallets |
| `menu_items` | `menu_items_public_read` | Anyone can read |
| `orders` | `orders_read_own` | Customers see only their own orders |
| `orders` | `orders_insert_own` | Customers can insert their own orders |
| `order_items` | `order_items_read_own` | Via subquery on orders.user_id |
| `payments` | `payments_read_own` | Via subquery on orders.user_id |

**Cashier and admin write policies** are deferred to Phase 4.

---

## 7. Current State of the Project

### ✅ Phase 1 — Complete
- Next.js 14 project scaffolded with TypeScript, Tailwind, App Router
- Dependencies installed: Supabase, Stripe, Zustand, react-hot-toast, lucide-react
- `.env.local` configured with all keys (Supabase, Stripe)
- Full database schema deployed to Supabase
- RLS enabled on all tables
- Stripe in test mode

### ✅ Phase 2 — Complete
- DB trigger auto-creates `public.users` row on Supabase auth signup
- Supabase browser + server clients configured (`src/lib/supabase/`)
- Next.js middleware protects `/dashboard`, `/admin`, `/cashier`, `/order`
- Signup page with duplicate email handling
- Login page with redirect-if-logged-in
- `useUser()` hook returns `{ user, role, loading }`
- `withRole()` HOC redirects unauthorized users to `/unauthorized`
- `/admin` and `/cashier` placeholder pages with role guards
- Dashboard wallet display: correct restaurant name + balance + currency label
- Campus Mensa seeded in DB (`ticket_count`, `tickets`, `ticket_eur_value = 8.00`)
- `CLAUDE.md` created in project root for persistent Claude Code context

### 🔄 Phase 3 — In Progress
**Done:**
- Route structure changed from `/menu/[slug]` to `/[slug]/menu`
- Dashboard redesigned as restaurant discovery page with popularity sorting, filters, search
- Restaurant cards with cover image, cuisine tags, pricing model badge
- `order_count`, `is_active`, `cuisine_tags`, `cover_image_url` columns added to `restaurants`
- Auto-increment trigger for `order_count` on order creation
- `ticket_eur_value` column added to `restaurants`
- DoorDash design tokens defined (CSS variables, DM Sans font)

**In progress / partially done:**
- Add-to-cart controls on menu items (being added now)
- Cart sidebar dynamic desktop behavior
- DoorDash visual redesign of all pages

**Not yet done in Phase 3:**
- Zustand cart store with single-restaurant enforcement
- CartSidebar full implementation
- PaymentSelector component
- Place order API route (`/api/orders`) with provision logic
- Stripe PaymentIntent creation
- Order confirmation page with Realtime subscription
- Admin menu management page
- Menu item seed data (3 items scripted, may need running)

---

## 8. What Still Needs to Be Built

### Phase 3 — Remaining
- [ ] Add-to-cart `+ / − N / −` controls on menu item cards
- [ ] Zustand cart store (single-restaurant enforcement, setPaymentMethod)
- [ ] Dynamic desktop cart sidebar (pushes menu content, collapses when empty)
- [ ] Mobile floating cart bar (pinned bottom, "View Cart" button)
- [ ] PaymentSelector (wallet balance check, mixed payment breakdown, ticket → € conversion)
- [ ] Place order POST API route (price validation, atomic transaction, provision logic)
- [ ] Stripe PaymentIntent with `capture_method: manual`
- [ ] Stripe Elements checkout component
- [ ] Order confirmation page with real-time status stepper
- [ ] Admin menu management CRUD page
- [ ] Full DoorDash visual redesign of all pages

### Phase 4 — Staff & Cashier Dashboard
- [ ] Live order queue via Supabase Realtime
- [ ] Order status flow controls (Pending → Preparing → Ready)
- [ ] Cashier pickup confirmation button (captures payment)
- [ ] Cashier wallet crediting UI (search user, enter ticket code, credit balance)
- [ ] Cancellation flow (releases provision)
- [ ] Cashier/admin RLS write policies

### Phase 5 — Anti-Abuse & Wallet
- [ ] Auto-cancel timeout (no pickup after X minutes → release provision)
- [ ] No-show detection and logging
- [ ] Wallet transaction history page for customers
- [ ] Admin audit log (all wallet transactions)
- [ ] Admin user role management

### Phase 6 — Polish & Deploy
- [ ] Re-enable Supabase email confirmation (production)
- [ ] Stripe webhook handler (`/api/webhooks/stripe`) for payment event reconciliation
- [ ] Stripe production keys + live mode setup
- [ ] Full mobile responsiveness audit
- [ ] Error boundary components
- [ ] Loading skeleton states
- [ ] Deploy to Vercel (connect Supabase production project)
- [ ] Pitch deck / demo for restaurant owner

---

## 9. Security Checklist (Ongoing)

- [x] `SUPABASE_SERVICE_ROLE_KEY` never in frontend files
- [x] RLS enabled on all tables
- [x] Customers cannot self-promote role
- [x] Customers cannot read other users' wallets
- [x] Only cashiers can credit wallets (enforced by RLS + API route)
- [x] Server re-validates prices before order creation (tamper prevention)
- [ ] Stripe webhook signature verification (Phase 6)
- [ ] Rate limiting on `/api/orders` (Phase 6)
- [ ] Input sanitization audit (Phase 6)

---

## 10. Seeded Data

```
Restaurant:   Campus Mensa
Slug:         campus-mensa
Model:        ticket_count
Label:        tickets
Ticket value: €8.00 per full ticket
Order count:  42 (seed)
Tags:         Italian, Pasta, Salads

Menu items (to seed if not done):
- Pasta al Pomodoro  — €4.50 / 1.0 ticket
- Insalata Mista     — €2.50 / 0.5 ticket
- Acqua Naturale     — €1.00 / 0.5 ticket

Test users:
- Admin:   your own account (promoted via SQL)
- Cashier: second account (promoted via SQL)
```

---

## 11. Claude Tooling Guide

| Task | Tool | Model | Flag |
|---|---|---|---|
| Everyday components, pages, fixes | Claude Code | Sonnet 4.6 | — |
| Stripe payment logic | Claude Code | Sonnet 4.6 | `--think` |
| RLS debugging | Claude Code | Sonnet 4.6 | `--think` |
| Supabase Realtime subscriptions | Claude Code | Sonnet 4.6 | `--think` |
| Mixed payment calculations | Claude Code | Sonnet 4.6 | `--think` |
| Security architecture decisions | Claude.ai chat | Opus 4.6 | — |
| Complex business logic (edge cases) | Claude.ai chat | Opus 4.6 | — |
| Reading Stripe/Supabase docs | Claude in Chrome | Sonnet 4.6 | — |
