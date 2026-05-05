# CampusEats — Improved Plan
*Companion to `CampusEats_Project_Brief.md` and `CLAUDE.md`. Supersedes the "What still needs to be built" section of the brief.*
*Last updated: 2026-05-05 (Phase 5 order lifecycle hardening complete)*

---

## 0. How to read this document

This is not a blank-slate replan — Phases 1, 2, and most of Phase 3 are sound. This document focuses on:

1. **Bugs and inconsistencies** in the current code that should be fixed before any new feature work.
2. **Architecture corrections** (mixed payment math, wallet held-balance, atomicity) that affect real money and need to be right before the app touches a live restaurant.
3. **A revised Phase 3 → Phase 6 plan** that adds the production-grade pieces missing from the original (webhook, RPC, tests, Sentry, auto-cancel).
4. **Open questions and risks** worth deciding on before V1.

Decisions already locked in from our planning conversation (2026-04-29):

- Mixed payment: kept, but reworked to **item-level greedy attribution** (see §2.1). ✅ **DONE**
- Wallet held state: original plan proposed `held_balance` column — **not adopted**. The live implementation uses `provision`/`release` transactions with an atomic `.gte('balance', ticketsProv)` conditional update instead. See §2.2 for the revised approach.
- Auto-cancel: **Supabase `pg_cron` + Edge Function** (see §2.5). Still planned.
- V1 production scope includes: Stripe webhook, atomic order RPC, money-math tests, Sentry.

---

## 1. Issues in the current code (fix before new features)

### 1.1 Role enum mismatch ✅ FIXED
~~`src/types/index.ts` declares `Role = 'student' | ...`~~ — corrected to `customer | cashier | admin` matching the DB enum. `withRole()` checks are correct.

### 1.2 `cartStore.removeItem` reset logic ✅ FIXED
Now computes against the post-filter array and spreads `EMPTY_CART` (preserving `paymentMethod`) when the result is empty.

### 1.3 No idempotency on `POST /api/orders` ✅ FIXED
`Idempotency-Key` header (UUID per submit attempt) is accepted by the route. Duplicate submissions return the original `orderId` + `stripeClientSecret` without creating a new order. The key is stored as `orders.idempotency_key` (unique, nullable). Client generates a fresh UUID on entering the payment-selector view and clears it on back-navigation.

### 1.4 Custom JS rollback is best-effort, not atomic
`route.ts` still does sequential writes with a manual `RollbackState` tracking `ticketsHeld`, `ticketsHeldAmt`, `ticketAccId`. The rollback runs in reverse insert order but cannot guard against process crashes mid-flight. This is acceptable for the current phase; migration to a Postgres RPC (§2.3) remains on the roadmap for pre-production hardening.

### 1.5 No Stripe webhook handler
Still unbuilt. The API route creates a `PaymentIntent` and returns `client_secret`; if the tab closes mid-3DS, the DB never learns the intent's final status. See §2.4 for the implementation plan.

### 1.6 Realtime publication step is undocumented
`OrderStatusClient.tsx` subscribes to `postgres_changes` filtered by `id=eq.{orderId}`. The `orders` table must be in the `supabase_realtime` publication — `alter publication supabase_realtime add table orders;`. Noted in CLAUDE.md Common Pitfalls but not yet in a checked-in migration file. Add to `supabase/migrations/` when migrations are set up.

### 1.7 No SQL migrations checked in
The repo still has no `supabase/migrations/` directory. Schema changes have been applied via the Supabase Studio UI and the MCP tools. Adopt Supabase CLI early in the next phase: `supabase init`, `supabase db pull`. See §5.2.

---

## 2. Architecture corrections

### 2.1 Mixed payment: item-level greedy attribution ✅ IMPLEMENTED
The server-side `POST /api/orders` now:
- Fetches current DB prices **and `ticket_eur_value`** (client-submitted prices are ignored).
- Uses `getEffectiveTicketCost(price_wallet_units, price_eur, ticketEurValue)` per item.
- Expands to individual units, sorts by effective ticket cost ascending, assigns each to wallet while `heldTickets + ticketCost ≤ balance`, else to card.
- Writes `wallet_quantity` + `stripe_quantity` per `order_items` row.

`PaymentSelector` client-side preview mirrors this exactly via `computeMixedSplit(items, balance)`. Card charge uses `item.unitPriceEur × qty` — never EUR-from-ticket conversion. Human-readable breakdown is shown under the wallet checkbox.

### 2.2 Wallet atomicity — revised approach (not `held_balance`)

**Original proposal:** add `held_balance` column to `wallet_accounts`.

**What was actually built:** the wallet `balance` is reduced at provision time and restored at release. This is enforced atomically via `.gte('balance', ticketsProv)` conditional update — if the balance is insufficient the update returns zero rows, the route 409s, and no order is created. Every wallet movement creates a `wallet_transactions` row (`provision` / `release` / `credit` / `debit`).

**Trade-off:** customers see their available balance drop immediately on order placement (correct). The UI does not need to show a separate "held" amount — the balance already reflects reality. `wallet_transactions.type = 'provision'` provides the audit trail.

**No change needed** — this approach is sound for V1. The `held_balance` column is removed from the §4 DB changes summary.

### 2.3 Atomic order creation via Postgres RPC
Still planned as a pre-production hardening step. The multi-write sequence (`orders` → `order_items` → `payments` → `wallet_transactions` → balance update → Stripe intent) currently lives in JS with a `RollbackState` guard. Moving this into a `SECURITY DEFINER` Postgres function makes the non-Stripe portion atomic and eliminates the custom rollback:

```sql
create or replace function public.place_order(
  p_user_id uuid,
  p_restaurant_id uuid,
  p_items jsonb,
  p_payment_method payment_method,
  p_wallet_amount numeric,
  p_stripe_amount_eur numeric,
  p_idempotency_key text
) returns table (order_id uuid, payment_id uuid, already_existed boolean)
language plpgsql security definer as $$
-- ...idempotency check, insert order/items/payment, atomic wallet deduction via row lock...
$$;
```

The API route then shrinks to: parse + authorise → fetch prices → compute split → call `place_order(...)` → if Stripe portion > 0, create PaymentIntent + update payments row. On Stripe failure: call `cancel_order(order_id)` RPC. Drop `RollbackState`.

### 2.4 Stripe webhook handler
Create `src/app/api/webhooks/stripe/route.ts`:

- Verify signature with `STRIPE_WEBHOOK_SECRET` (`stripe.webhooks.constructEvent`).
- Handle `payment_intent.amount_capturable_updated` (3DS confirmed) → timestamp it.
- Handle `payment_intent.canceled` → call `cancel_order(order_id)` to release wallet hold + cancel order.
- Handle `payment_intent.payment_failed` → mark `payments.status = 'failed'`, release wallet, set order to `cancelled`.
- Handle `payment_intent.succeeded` (after capture) → mark `payments.status = 'captured'`.
- All handlers idempotent — Stripe retries.

Local dev: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

### 2.5 Auto-resolve via `pg_cron` + Next.js API route ✅ IMPLEMENTED

**What was built** (differs from the original Edge Function plan):

```sql
-- pg_cron + pg_net call the Next.js API route directly (no Edge Function needed)
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

Route logic (`POST /api/internal/auto-resolve`):
1. Auth: `Authorization: Bearer CRON_SECRET` (fixed secret in env, not Supabase JWT).
2. Cancel candidates: `status IN ('awaiting_payment', 'pending')` AND `created_at < now() − 5 min`.
   - For each: `cancelOrder()` helper (release wallet provision + void Stripe intent + mark cancelled).
3. Complete candidates: `status = 'ready'` AND `updated_at < now() − 15 min`.
   - For each: `captureOrder()` helper (Stripe capture + wallet debit + mark completed).
   - `captureOrder()` accepts optional `cashierId` — auto-complete passes none.
4. Returns `{ cancelled: N, completed: N }`. Logs individual failures but continues.
5. Fully idempotent — each helper re-checks DB state before mutating.

**Local testing** (pg_cron can't reach localhost):
```
curl -X POST http://localhost:3000/api/internal/auto-resolve \
  -H "Authorization: Bearer dev-cron-secret-replace-in-prod" \
  -H "Content-Type: application/json"
```

**Cancellation thresholds:**
- `pending` / `awaiting_payment` → 5 min (restaurant may not have seen it; full refund)
- `ready` → 15 min from last `updated_at` (food was made; charge kept, no refund)

### 2.6 Capture-on-pickup flow (Phase 4)
Cashier hits "Confirm pickup":

1. Server route `POST /api/orders/[id]/confirm` (cashier-only, role-checked).
2. RPC `capture_order(order_id)` — atomic: insert `wallet_transactions` row of type `debit`, set `orders.status = 'completed'`, `payments.status = 'captured'`. (Balance was already reduced at provision time — no second deduction needed.)
3. If `stripe_payment_intent_id` is set: `stripe.paymentIntents.capture(id)`. Webhook reconfirms.

### 2.7 Cancel-by-cashier flow (Phase 4)
1. `POST /api/orders/[id]/cancel` (cashier-only).
2. RPC `cancel_order(order_id)` — atomic: restore wallet balance (`+= provisioned_amount`), insert `wallet_transactions` row of type `release`, set `orders.status = 'cancelled'`.
3. If Stripe intent exists: `stripe.paymentIntents.cancel(id)`. Webhook reconfirms.

### 2.8 Cashier wallet-credit flow (Phase 5)
Cashier searches for a user (by email or QR), enters a ticket code (e.g. `[1],[4]` = 1.0 ticket, `[1],[1]` = 0.5 ticket), confirms. Server route credits the user's wallet and inserts a `credit` transaction. RPC `credit_wallet(wallet_account_id, amount, cashier_id, source_note)`.

Abuse prevention: only authenticated cashiers can call it (role check + RLS), every credit is logged with `cashier_id`. Admin audit page (Phase 5) shows the full credit log, filterable by cashier.

---

## 3. Revised phase plan

### Phase 3 — customer ordering loop ✅ COMPLETE
All items done, including:
- Item-level greedy attribution + `wallet_quantity`/`stripe_quantity` on `order_items`
- Idempotency via `Idempotency-Key` header + `orders.idempotency_key` column
- `PaymentSelector` with accurate per-item greedy preview
- `StripeCheckout` with manual DOM mount + `onSuccess` callback
- `DELETE /api/orders/[orderId]` for cancel-on-back
- Order status page with Supabase Realtime subscription
- TopNav avatar dropdown (wallet + logout)
- Wallet page with restaurant cards linking to `/{slug}/menu`
- E2E Playwright suite: menu, cart, wallet order, Stripe card, Stripe 3DS — **12/12 passing**

### Phase 3.5 — unified ticket model refactor ✅ COMPLETE
- DB migration: Shalimar `price_wallet_units` reset to 0; wallet balances converted EUR→tickets
- API route: `getEffectiveTicketCost` helper; fetches `ticket_eur_value`; greedy uses conversion
- MenuCard: `ticketEurValue` prop; shows ticket label only for explicit prices; effective cost stored in cart
- CartSidebar: removed `pricing_model` dependency; `showTicketBreakdown` for all restaurants
- Admin form: ticket equivalent field (0 = auto-convert); validation fixed

### Phase 3.6 — admin menu management ✅ COMPLETE
Admin CRUD for menu items is fully built and tested.

Done:
- **Soft-delete**: `menu_items.deleted_at TIMESTAMPTZ DEFAULT NULL` column + index. `handleDelete` sets `deleted_at`; filter `.is('deleted_at', null)` applied in both the admin fetch and the public `/[slug]/menu` query. Preserves price snapshots in existing `order_items` rows.
- **RLS**: `admin_write` policy applied to `menu_items` (FOR ALL, WITH CHECK on `users.role = 'admin'`). This was the missing policy; without it, browser-client INSERT/UPDATE silently failed.
- **Delete UI**: trash icon button in modal footer (only when editing), `window.confirm` guard, toast `'Item deleted.'`
- **Admin Playwright project**: `admin-setup` + `admin` projects added to `playwright.config.ts`; `testIgnore: /admin/` added to `chromium` project to prevent customer session running admin specs.
- **E2E tests**: `e2e/admin.setup.ts` + `e2e/admin-menu.spec.ts` — 5 tests (page load, create, edit, toggle availability, delete). Sequence cleans up after itself.
- **Full suite**: 18/18 passing (13 customer + 5 admin).

Still deferred:
- Image upload to Supabase Storage (form currently accepts a URL string). Planned for Phase 6.

### Phase 4 — staff & cashier dashboard ✅ COMPLETE
1. ✅ `/cashier` live order queue, subscribed via Supabase Realtime to `orders` filtered by `restaurant_id`.
2. ✅ Order card with status flow controls (Pending → Preparing → Ready).
3. Cashier RLS policies deferred — all cashier writes use service-role API routes + role checks in code (intentional, see plan §3 decision notes).
4. ✅ Capture-on-pickup: `POST /api/cashier/orders/[id]/confirm` — Stripe capture + wallet debit audit row + DB finalise via `src/lib/orders/capture.ts`.
5. ✅ Cancel button: `POST /api/cashier/orders/[id]/cancel` — void Stripe + release wallet provision via `src/lib/orders/cancel.ts` (shared with customer DELETE route).
6. ✅ Pickup identification: live queue is primary; customer's `/order/[id]` shows a 6-char pickup code (last 6 of UUID uppercased).
7. ✅ Order history view: today's completed + cancelled orders, collapsed by default.

Also done in Phase 4:
- ✅ **Stripe webhook** `POST /api/webhooks/stripe` — signature-verified; handles `payment_intent.canceled`, `payment_intent.payment_failed`, `payment_intent.succeeded`, `payment_intent.amount_capturable_updated`; fully idempotent.
- ✅ `src/lib/orders/cancel.ts` + `capture.ts` — shared helpers; no duplicated logic across routes.
- ✅ `CashierOrder`, `CashierPayment`, `OrderItem`, `OrderPayment` types added to `src/types/index.ts`.
- ✅ TopNav: "Cashier" link visible for cashier + admin roles.
- ✅ `GET /api/cashier/orders?restaurantId=` — active queue + today's history with full PostgREST joins.

### Phase 5 — order lifecycle hardening ✅ PARTIALLY COMPLETE

Done:
- ✅ **`awaiting_payment` status** — card/mixed orders created with `status='awaiting_payment'`; invisible to cashier queue until Stripe confirms. Wallet orders remain `status='pending'` from the start.
- ✅ **`authorized` payment status** — added to `payment_status` enum; set at creation for wallet orders, set by authorize route for card orders.
- ✅ **`POST /api/orders/[orderId]/authorize`** — primary payment confirmation path. StripeCheckout calls this synchronously after `confirmPayment()`. Verifies intent with Stripe directly; moves `awaiting_payment → pending`. Idempotent. Stripe webhook is the fallback.
- ✅ **3DS redirect handling** — `order/[orderId]/page.tsx` detects `?redirect_status=succeeded` + `order.status='awaiting_payment'` and runs the same authorize logic server-side before rendering.
- ✅ **Customer cancel button** on `/order/[orderId]` — shown when `status === 'pending'` (restaurant hasn't started preparing). Calls `DELETE /api/orders/[orderId]`; Realtime subscription updates UI to `cancelled` automatically.
- ✅ **`document.visibilitychange` listeners** in `OrderStatusClient` and `CashierDashboardClient` — refetches current state from DB when tab is re-focused (guards against Realtime delivery gaps in backgrounded tabs).
- ✅ **Auto-resolve via pg_cron** (§2.5) — `POST /api/internal/auto-resolve` runs every minute.
  - `awaiting_payment` + `pending` orders > 5 min → full cancel + refund
  - `ready` orders > 15 min (by `updated_at`) → auto-complete, charge kept (food was made)
- ✅ **`orders.updated_at`** column + auto-update trigger — used by the ready-timeout check.
- ✅ **`captureOrder()` cashierId optional** — auto-complete inserts wallet debit without a cashier actor.
- ✅ **`staff_read_orders` RLS policy** — enables Supabase Realtime to deliver order events to cashier/admin sessions (the Realtime subscription enforces RLS; without this policy, cashiers received no events for other users' orders).

Remaining:
- [ ] Cashier wallet credit UI (§2.8) — top-up tickets for customers.
- [ ] Customer wallet transaction history page (`/dashboard/wallet/[restaurantId]/history`).
- [ ] Admin audit log: every wallet credit grouped by cashier, daily totals, anomaly highlighting.
- [ ] Admin user role management page.
- [ ] Customer order history page (`/dashboard/orders`).
- [ ] No-show counter on `users` (cashier sees flagged customers); admin can override.

### Phase 6 — production readiness & deploy
1. ~~**Stripe webhook** (§2.4)~~ ✅ Done in Phase 4.
2. **Atomic RPC** (§2.3) — pre-production hardening, replaces JS rollback.
3. Re-enable Supabase email confirmation.
4. Stripe production keys, live mode.
5. Sentry in `next.config.js` + `instrumentation.ts`. Tag every API route with user ID + order ID.
6. Tests:
   - Vitest unit tests for cart selectors, `computeMixedSplit()`, ticket-code parser.
   - Playwright E2E: signup → order → cashier capture.
   - ~~E2E for admin menu management~~ ✅ Done (Phase 3.6).
7. Rate limiting on `/api/orders` (Upstash Ratelimit, 10 req/min/user).
8. Privacy policy + terms of service pages. GDPR data deletion endpoint.
9. Italian translation pass (`next-intl` or a simple `t()` map).
10. Mobile responsiveness audit, error boundaries, loading skeletons.
11. Deploy to Vercel; connect Supabase production project; run migrations; configure Stripe webhook URL.

---

## 4. Database changes summary

Changes already applied to the live DB (reflected in CLAUDE.md):

```sql
-- These are already in the live DB:
-- orders.idempotency_key (unique, nullable)
-- order_items.wallet_quantity, order_items.stripe_quantity
-- wallet_transactions.cashier_id (nullable — renamed from NOT NULL column)
-- menu_items.deleted_at (TIMESTAMPTZ DEFAULT NULL) + index on (restaurant_id) WHERE deleted_at IS NULL
-- RLS: menu_items "admin_write" policy (FOR ALL, USING + WITH CHECK on users.role = 'admin')
```

Remaining additions for Phases 4–6:

```sql
-- Per-restaurant auto-cancel threshold
alter table restaurants add column auto_cancel_minutes int not null default 30;

-- Cashier attribution on wallet credits (cashier_id already nullable in wallet_transactions)
-- No schema change needed — cashier_id column exists

-- Realtime publication (do once — verify it's set)
alter publication supabase_realtime add table orders;

-- After every change:
notify pgrst, 'reload schema';
```

RPCs to write (§2.3, §2.5, §2.6, §2.7, §2.8) — keep them in `supabase/migrations/` once the CLI is set up.

---

## 5. Cross-cutting improvements

### 5.1 Observability
- **Sentry** in `next.config.js` + `instrumentation.ts`. Tag every API route with user ID + order ID.
- **Structured logging** in API routes — `console.log(JSON.stringify({level, msg, orderId, userId}))`. Vercel ingests + greppable.
- **Stripe event log table** — insert each webhook event (`id = evt_…`) before processing. Idempotency for free + paper trail.

### 5.2 Migrations
- `supabase init` in repo root. `supabase db pull` to capture the current schema as a baseline migration.
- All future schema and RLS changes go through migrations committed to git. Apply with `supabase db push`.
- Add this workflow to `CLAUDE.md` so schema changes stop happening exclusively via the Studio UI.

### 5.3 Tests
Minimum viable test set, in priority order:

1. `selectTotalEur`, `selectNTickets`, `selectItemCount` — pure functions, trivial to Vitest.
2. `computeMixedSplit(items, walletBalance)` — highest-value test target. Cover: pure wallet, pure stripe, exact wallet match, wallet smaller than cheapest item, wallet covers all but one, subsidised pricing edge cases.
3. Ticket-code parser — `parseTicketCode("[1],[4]") === 1.0`.
4. ~~E2E admin menu management~~ ✅ Done — 5 tests passing (Phase 3.6).
5. E2E cashier confirm-pickup happy path.

### 5.4 Security tightening
- ~~Stripe webhook signature verification (§2.4)~~ ✅ Done — `stripe.webhooks.constructEvent` in `/api/webhooks/stripe`.
- Rate limit `POST /api/orders` to 10/min/user (Upstash).
- CSP headers in `next.config.js` (relaxed for Stripe + Supabase domains).
- Audit RLS policies before launch — cashier write policies (Phase 4) are the riskiest surface.

---

## 6. Open questions and risks

### 6.1 How does the cashier identify a customer at pickup? ✅ RESOLVED
**Implemented:** live queue is the primary mechanism; customer's `/order/[id]` shows a 6-char pickup code (last 6 of UUID uppercased) as fallback. QR code deferred as a Phase 6 polish item.

### 6.2 Notifications when order is `ready`?
Today the customer must keep `/order/[id]` open.

1. Browser tab title flashes `(READY) Your order` — zero infra. Do this for V1.
2. Web Push — needs a Service Worker + push provider. Moderate effort. Defer.
3. SMS via Twilio. Most reliable; costs per order. Defer unless restaurant owner requests it.

### 6.3 GDPR / data retention
- Privacy policy linking to Stripe's and Supabase's policies.
- "Delete my account" button: anonymises past orders (preserves the restaurant's books), deletes auth user + wallet.
- Retention policy: orders and wallet transactions kept 7 years minimum (Italian tax law).

### 6.4 What happens when a restaurant changes `ticket_eur_value`?
Existing wallet balances are in ticket units, so EUR-equivalent value changes overnight. For V1 this is a deliberate price update (expected behaviour). Pre-launch: add `restaurant_ticket_value_history` table + a UI confirmation modal before any change. Phase 5 admin tool.

### 6.5 Multi-restaurant scope
Schema supports it; the discovery dashboard already lists multiple restaurants. Several pieces are restaurant-singular today. For V1 with one real restaurant this is fine. When restaurant #2 onboards, expect a refactor pass on: wallet display per restaurant, cart restaurant switching, admin role scoped per restaurant.

### 6.6 Image hosting
`menu_items.image_url` exists. The admin form currently takes a URL string. For real use: Supabase Storage bucket, RLS `admin_write` policy, upload widget in the admin form, Supabase Storage hostname added to `next.config.js` `remotePatterns`.

---

## 7. Suggested execution order (next 2–3 weeks)

1. ~~**Phase 3.6 E2E tests**~~ ✅ Done — soft-delete, admin_write RLS, 5 admin E2E tests, 18/18 passing.
2. **Supabase migrations setup** (§5.2) — `supabase init` + `db pull`. ~1–2h.
3. ~~**Stripe webhook handler** (§2.4)~~ ✅ Done in Phase 4.
4. ~~**Phase 4: cashier dashboard**~~ ✅ Done — live order queue, status flow, capture/cancel, today's history, pickup code.
5. ~~**Phase 4: RLS policies for cashier writes**~~ Deferred intentionally — service-role API + role-check-in-code approach used instead.
6. ~~**Phase 5: order lifecycle hardening**~~ ✅ Done — `awaiting_payment` gate, authorize route, customer cancel button, auto-resolve cron, visibility refetch, `staff_read_orders` RLS.
7. **Phase 5 (remaining):** cashier wallet credit UI (§2.8). ~1–2 days.
8. **Phase 6 hardening:** atomic RPC (§2.3), Sentry, rate limiting, Vitest unit tests. ~2–3 days.
9. **Phase 6 launch prep:** GDPR pages, Italian translation, mobile audit, deploy to Vercel + update pg_cron URL. ~2–3 days.

That puts a credible production-ready V1 around 1 week of focused work remaining.

---

## 8. What to keep doing

These are good calls in the current setup — the improved plan keeps them unchanged:

- Multi-tenant schema from day one.
- Service-role client only inside `src/app/api/`.
- Price snapshots on `order_items`. Critical for refund correctness years later.
- Manual-capture Stripe flow. Right tool for the no-show problem.
- Provision/release wallet transaction model (replaces the proposed `held_balance` column — simpler, equally correct).
- DoorDash-derived design system with CSS variables. Easier to theme per restaurant later.
- DM Sans + Tailwind + Zustand stack.
- `withRole()` HOC + middleware double-guard.
- Cookie-based Supabase server client + service-role admin client separation.
- Playwright E2E suite with `fullyParallel: false` and `afterEach` cleanup.

The architecture is fundamentally sound — the remaining changes are surgical, not a rewrite.
