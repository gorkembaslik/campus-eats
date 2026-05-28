# CampusEats

A full-stack food ordering platform built for campus restaurants — think digital meal tickets, a real-time cashier queue, and Stripe card payments, all in one place.

## What is this?

Universities often have on-campus restaurants where students pay with physical meal tickets — little paper booklets handed out at the start of term. The problem is that ordering still happens the old-fashioned way: you queue at the counter, wave a piece of paper, and hope the staff can keep up during the lunch rush.

CampusEats replaces that chaos with a proper digital platform. Students browse the menu, add items to their cart, and pay either from their digital wallet (loaded with ticket credits) or by card via Stripe. The order lands instantly in the cashier's live queue, and the student gets a real-time status update as it moves from "preparing" to "ready for pickup."

The wallet system mirrors how physical tickets work. A cashier scans a student's QR code to top up their balance — "depositing" their paper tickets as digital credits. From there, students spend directly from their wallet without touching cash or cards. Card payment and mixed payments (part wallet, part card) are also fully supported.

## Live Demo

> `https://campus-eats-unimi.vercel.app`

### Demo accounts

| Role | Email | Password | Wallet balance |
|------|-------|----------|----------------|
| Customer | `demo.customer@campuseats.demo` | `CampusCustomer1!` | €30 at Shalimar · €30 at Dahlia Oven |
| Admin | `demo.admin@campuseats.demo` | `CampusAdmin1!` | — |

> These are sandboxed demo accounts — feel free to place real test orders. Stripe is in test mode, so no real charges occur.

### What to try

**As the customer (`demo.customer@campuseats.demo`):**
1. Browse restaurants on the dashboard
2. Open Shalimar, add a few items to your cart
3. At checkout, choose "Pay with wallet" — your €30 balance covers the order
4. Watch the order status update live after placing it
5. Visit "My Wallet" in the nav to see the transaction history

**As the admin (`demo.admin@campuseats.demo`):**
1. Head to `/admin` to manage menu items — add, edit, or soft-delete
2. Check `/cashier` to see the live order queue (confirm pickups here)
3. Use the audit log to trace every wallet transaction
4. Visit user management to change roles

**Testing Stripe card payments:**
Use Stripe's test card `4242 4242 4242 4242`, any future expiry, and any CVC.

For 3D Secure testing: `4000 0025 0000 3155`

## Features

- **Digital wallet** — per-restaurant balance, loaded by cashier QR scan
- **Dual payment** — wallet, card (Stripe), or mixed (wallet covers what it can, card picks up the rest)
- **Real-time cashier queue** — Supabase Realtime pushes order updates instantly; no refresh needed
- **Manual Stripe capture** — payment is pre-authorized at checkout and only captured when the cashier confirms pickup
- **Per-item price snapshots** — order history is never affected by menu changes after the fact
- **Audit log** — every wallet movement is recorded with a full transaction trail
- **Admin panel** — menu CRUD, user role management, soft-delete for menu items
- **Role-based access** — customers, cashiers, and admins each see a different interface enforced at the database level (RLS) and in the UI

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | Supabase (PostgreSQL + Row-Level Security + Realtime) |
| Auth | Supabase Auth |
| Payments | Stripe (manual capture, 3D Secure) |
| State | Zustand |
| Styling | Tailwind CSS |
| Testing | Playwright (18 E2E tests) |

## Local setup

**1. Clone and install**
```bash
git clone https://github.com/gorkembaslik/campus-eats.git
cd campus-eats
npm install
```

**2. Set up environment variables**

Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
CRON_SECRET=
```

**3. Start the dev server**
```bash
npm run dev
```

**4. Forward Stripe webhooks** (required for card payments to complete)
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
Copy the webhook signing secret printed by that command into `STRIPE_WEBHOOK_SECRET` in `.env.local`.

Open [http://localhost:3000](http://localhost:3000).

## Running tests

```bash
npm run test:e2e          # headless
npm run test:e2e:ui       # interactive Playwright UI
```

Tests require a `.env.test` file with test account credentials (see `.env.example`).
