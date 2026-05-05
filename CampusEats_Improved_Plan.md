# CampusEats — Plan

*Last updated: 2026-05-05*

---

## Current state (Phases 1–5 complete)

All core features are shipped and passing 18/18 Playwright tests:

- **Auth + roles** — customer / cashier / admin, middleware + `withRole()` HOC
- **Menu** — `/{slug}/menu`, category tabs, ticket price display, hero banner
- **Cart + checkout** — wallet checkbox, greedy mixed attribution, idempotency, Stripe manual capture
- **Order lifecycle** — `awaiting_payment → pending → preparing → ready → completed/cancelled`
- **Cashier dashboard** — Realtime queue, status controls, confirm pickup, cancel, today's history
- **Cashier wallet credit** — QR scan + manual UUID, denomination basket (`1-1 = 0.5t`, `1-4 = 1.0t`), idempotent POST
- **Stripe webhook** — signature verified, 4 event types, idempotent handlers
- **Auto-resolve cron** — pg_cron → `/api/internal/auto-resolve` every minute; 5-min pending timeout (full refund), 15-min ready timeout (charge kept)
- **Customer wallet history** — `/dashboard/wallet/[restaurantId]` with QR code display
- **Customer order history** — `/dashboard/orders`, paginated
- **Admin audit log** — `/admin/audit`, grouped by cashier or flat, date/restaurant/cashier filters
- **Admin user management** — `/admin/users`, optimistic updates, last-admin guard
- **Admin menu CRUD** — soft-delete, availability toggle, ticket price management
- **E2E suite** — 18/18 Playwright tests (menu, cart, wallet order, Stripe card, Stripe 3DS, admin menu)

---

## Phase 6 — production readiness

### Must-do before launch

**Deploy to Vercel**
1. Set all env vars in Vercel dashboard.
2. Connect Supabase production project (separate from dev).
3. Configure Stripe live-mode keys + production webhook URL.
4. Update pg_cron job URL — see `CLAUDE.md` "After Vercel deploy" section.
5. Re-enable Supabase email confirmation (disabled during dev).

**Atomic order creation RPC**
The multi-write sequence in `POST /api/orders` (orders → order_items → payments → wallet_transactions → balance update) uses a JS `RollbackState` guard. A process crash mid-flight leaves orphaned rows. Move the DB portion into a `SECURITY DEFINER` Postgres function to make it truly atomic. Stripe intent creation stays in JS (can't be in a transaction anyway); on Stripe failure, call a `cancel_order()` RPC.

**Supabase migrations in git**
Schema has been applied via Studio UI and MCP tools. Before launch: `supabase init` + `supabase db pull` to capture the current schema as a baseline migration. All future changes go through `supabase/migrations/` committed to git.

**Rate limiting**
`POST /api/orders` — 10 req/min/user via Upstash Ratelimit. Prevents wallet drain attacks.

### Should-do

**Observability**
- Sentry in `next.config.js` + `instrumentation.ts`; tag every error with `userId`, `orderId`.
- Stripe event log table — insert each webhook `id` (`evt_…`) before processing. Free idempotency + paper trail.

**Vitest unit tests** (pure functions, no DB):
1. `selectTotalEur`, `selectNTickets`, `selectItemCount` — trivial.
2. `computeMixedSplit(items, balance)` — highest value. Cover: pure wallet, pure Stripe, exact match, wallet < cheapest item, wallet covers all-but-one.
3. `getEffectiveTicketCost(price_wallet_units, price_eur, ticketEurValue)`.

**CSP headers** in `next.config.js` — relax for Stripe and Supabase domains.

### Deferred (post-V1)

- Image upload to Supabase Storage (admin form currently accepts a URL string).
- Web Push / SMS notifications when order is `ready`.
- Italian translation (`next-intl` or a simple `t()` map).
- No-show counter on `users` (cashier sees flagged customers).
- Admin UI to edit per-restaurant `ticket_denominations`.
- `restaurant_ticket_value_history` table (audit trail when `ticket_eur_value` changes).
- Multi-restaurant admin roles (admin scoped per restaurant, not global).
- GDPR "delete my account" endpoint (anonymise past orders, delete auth user + wallet).

---

## Open risks

**`ticket_eur_value` changes** — existing wallet balances are in ticket units, so their EUR-equivalent value changes overnight. For V1 this is an intentional price update. Add a confirmation modal in the admin before any change goes to production.

**Last-admin race** — two admins demoting each other simultaneously could leave 0 admins. The UI guards against this with a count check, but there's a race window. Recoverable via direct DB access; acceptable for V1.

**pg_cron URL** — currently points to localhost (dev). Update to the Vercel URL before enabling the production cron. See `CLAUDE.md`.

**Stripe minimum** — card charge < €0.50 returns 400. Any menu configuration where a mixed split produces a tiny card charge will hit this. The API surfaces the error; the admin needs to be aware.

---

## Architecture decisions to keep

- Service-role client only inside `src/app/api/`. RLS enforced on browser client paths.
- Price snapshots on `order_items` at order time — mandatory for refund correctness.
- Provision/release wallet transaction model (no `held_balance` column — simpler, equally correct).
- Manual-capture Stripe flow — right tool for the no-show problem.
- `fullyParallel: false` in Playwright — prevents DB race conditions between order tests.
