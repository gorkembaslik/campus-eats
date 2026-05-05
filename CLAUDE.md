# CampusEats — Claude Code Guide

## Dev commands
```
npm run dev            # dev server
npm run test:e2e       # Playwright headless
npm run test:e2e:ui    # Playwright interactive
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Local auto-resolve (pg_cron can't reach localhost):
```
curl -X POST http://localhost:3000/api/internal/auto-resolve \
  -H "Authorization: Bearer dev-cron-secret-replace-in-prod" \
  -H "Content-Type: application/json"
```

## Environment variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   ← API routes only — NEVER in client components
STRIPE_SECRET_KEY           ← API routes only
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET       ← printed by `stripe listen`; paste into .env.local
CRON_SECRET                 ← any random string; must match pg_cron Authorization header
```

## Supabase clients
- **Browser** `src/lib/supabase/client.ts` — anon key; use in client components + hooks
- **Server** `src/lib/supabase/server.ts` — anon + cookies; use in server components
- **Admin** — `createSupabaseClient(url, SERVICE_ROLE_KEY)` inline in API routes only; bypasses RLS

Always `getUser()` on the server — `getSession()` doesn't verify with the Auth server and is insecure.

After any FK or RLS policy change: `notify pgrst, 'reload schema';`

## Database — non-obvious column names
`order_items`: `unit_price_eur`, `unit_price_wallet_units`, `wallet_quantity`, `stripe_quantity`  
`wallet_transactions`: `wallet_id` (not `wallet_account_id`), `cashier_id` (nullable)  
`restaurants`: includes `ticket_denominations jsonb` — default `{"1-1": 0.5, "1-4": 1.0}`

`pricing_model` column exists but is **not used in any payment logic**. Never branch on it.

## Ticket model — critical rules
Wallets hold **ticket units**, never euros.

Effective ticket cost per item:
```
price_wallet_units > 0  →  use directly (explicit student price)
price_wallet_units = 0  →  price_eur / ticket_eur_value  (auto-convert — NOT card-only)
```

Guard against `ticket_eur_value = 0` (division by zero). Always fetch it — don't skip it.

## Payment invariants
- Stripe uses `capture_method: manual`. Confirmed intents are `requires_capture`, NOT `succeeded`.
- `awaiting_payment` orders are invisible to the cashier queue until Stripe confirms → `pending`.
- Wallet orders: `payments.status = 'authorized'` at creation (not `'pending'`).
- Wallet deduction is atomic: `.gte('balance', ticketsProv)` — zero rows returned = 409, order rejected.
- Every wallet movement requires a `wallet_transactions` row. No exceptions.
- Mixed card charge = `item.unitPriceEur × qty`, never `ticketShortfall × ticket_eur_value`.
- `clearCart()` must be called before `router.push('/order/...')` — navigating first leaves a ghost cart.

## RLS — two non-obvious requirements
1. **Admin menu writes** use the browser client (anon key). The `admin_write` policy on `menu_items` (FOR ALL with USING + WITH CHECK) must exist or INSERT/UPDATE silently fails.
2. **Supabase Realtime enforces RLS** — cashiers need the `staff_read_orders` policy on `orders` or they receive no Realtime events for other users' orders.

RLS blocks PostgREST joins — if a joined table has no SELECT policy, the join returns `null`.

## Supabase Realtime
- `orders` table must be in the `supabase_realtime` publication.
- Realtime INSERT fires before joined rows exist. Gate cashier queue visibility on `orders.status` only — never on joined `payments` columns (they won't be there yet).

## Cashier wallet credit
- Denomination codes: `1-1 = 0.5 tickets`, `1-4 = 1.0 ticket` (stored in `restaurants.ticket_denominations`).
- Idempotency: prefix `note` with `idem:<uuid> | ` and check `LIKE 'idem:<key>%'` — no schema change needed.
- `credit_wallet(p_wallet_id, p_amount)` RPC does the atomic balance increment.
- `html5-qrcode` must be `await import('html5-qrcode')` inside an async client effect — top-level import crashes the Next.js build.

## Design system
All tokens are in `src/styles/tokens.css`. Never hardcode colours, radii, or shadows — always use CSS variables (`--red`, `--red-dark`, `--red-light`, `--surface`, `--surface-2`, `--surface-3`, `--text-1/2/3`, `--border`, `--success`, `--radius-sm/md/lg`, `--shadow-sm/md/lg`).

Always show `currency_label` from the restaurant — never hardcode `€`, `$`, or "tickets".

## E2E testing (Playwright)
Credentials in `.env.test` (gitignored): `TEST_CUSTOMER_EMAIL`, `TEST_CUSTOMER_PASSWORD`, `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`.

Test customer must have ≥ 1 ticket balance at `dahlia-oven` for the wallet-order test.

Two Playwright projects separated by `testIgnore`/`testMatch`: `chromium` (customer) and `admin`.

Key patterns:
- Desktop viewport 1280×800 — cart sidebar auto-expands, avoids mobile ambiguity
- Scope quantity buttons to the sidebar: `sidebar.getByRole('button', { name: 'Add one more' })`
- Admin tests use `getByPlaceholder`, not `getByLabel` — `Field` component has no `htmlFor`
- Admin toast assertions need `{ timeout: 15_000 }` — Supabase round-trips can exceed 5s
- 3DS test needs `test.setTimeout(120_000)` — the full 3DS flow takes 60–80s
- 3DS iframe: Playwright's synthetic `click()` is silently dropped by cross-origin sandboxed iframes. Use `frame.evaluate(() => btn?.click())`. Find the challenge frame by iterating `page.frames()` and checking `locator('button:has-text("Complete")').isVisible()` — do NOT use `frameLocator().first()` (picks the Payment Element, not the 3DS overlay).
- 3DS redirect race: `Promise.all([page.waitForURL(...), frame.evaluate(...)])` — never `await click()` then `waitForURL`.
- Test selector text must not contain "pending" or "preparing" — tests use `getByText(/pending|preparing/i)` to check order status.

## After Vercel deploy — update pg_cron
```sql
SELECT cron.unschedule('auto-resolve-orders');
SELECT cron.schedule(
  'auto-resolve-orders', '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://YOUR-APP.vercel.app/api/internal/auto-resolve',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
```
Also set `CRON_SECRET` in Vercel environment variables.
