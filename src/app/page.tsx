import Link from 'next/link'
import { Wallet, Zap, CreditCard, Shield, BarChart3, QrCode, ArrowRight } from 'lucide-react'

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.34-3.369-1.34-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.607.069-.607 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  )
}

const features = [
  {
    Icon: Wallet,
    title: 'Digital meal tickets',
    desc: 'Per-restaurant wallet balances replace paper ticket booklets. Cashiers top up accounts by scanning a student QR code.',
  },
  {
    Icon: Zap,
    title: 'Real-time cashier queue',
    desc: 'Supabase Realtime pushes order updates the moment they arrive — no polling, no refresh needed on either side.',
  },
  {
    Icon: CreditCard,
    title: 'Stripe card payments',
    desc: 'Full Stripe integration with manual capture and 3D Secure. Payment is pre-authorised at checkout, captured only on pickup.',
  },
  {
    Icon: Shield,
    title: 'Row-level security',
    desc: 'PostgreSQL RLS enforced at the database level. Customers see only their orders; cashiers see only their restaurant\'s queue.',
  },
  {
    Icon: BarChart3,
    title: 'Full audit trail',
    desc: 'Every wallet movement generates an immutable transaction record. Admins can trace every credit, debit, and refund.',
  },
  {
    Icon: QrCode,
    title: 'Idempotent QR top-up',
    desc: 'Students show their QR code; cashiers scan to credit the wallet. Scanning twice never double-credits — idempotency built in.',
  },
]

const steps = [
  {
    n: '01',
    title: 'Browse the menu',
    desc: "Pick items from your campus restaurant. Prices display in ticket units or euros depending on the restaurant's configuration.",
  },
  {
    n: '02',
    title: 'Pay your way',
    desc: 'Use your wallet balance, a Stripe card, or a mix of both. Card payments are pre-authorised and only captured on pickup.',
  },
  {
    n: '03',
    title: 'Pick up when ready',
    desc: "Your order lands instantly in the cashier's live queue. Watch the status update in real time — no page refresh needed.",
  },
]

const stack = [
  { label: 'Next.js 14', bg: '#000000', color: '#ffffff' },
  { label: 'TypeScript', bg: '#3178c6', color: '#ffffff' },
  { label: 'Supabase', bg: '#3ecf8e', color: '#ffffff' },
  { label: 'PostgreSQL', bg: '#336791', color: '#ffffff' },
  { label: 'Stripe', bg: '#635bff', color: '#ffffff' },
  { label: 'Playwright', bg: '#2ead33', color: '#ffffff' },
  { label: 'Tailwind CSS', bg: '#0ea5e9', color: '#ffffff' },
  { label: 'Zustand', bg: '#FF6B35', color: '#ffffff' },
]

export default function Home() {
  return (
    <main>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section
        className="px-6 py-20 sm:py-28"
        style={{ background: 'linear-gradient(160deg, #ffffff 60%, #fff0ee 100%)' }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-14 items-center">

            {/* Copy */}
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-6"
                style={{ background: 'var(--red-light)', color: 'var(--red)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)]" />
                Portfolio project — live demo available
              </div>

              <h1
                className="text-5xl sm:text-6xl font-bold leading-[1.1] tracking-tight mb-6"
                style={{ color: 'var(--text-1)' }}
              >
                Campus dining,{' '}
                <span style={{ color: 'var(--red)' }}>digitised.</span>
              </h1>

              <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--text-2)', maxWidth: 500 }}>
                Digital meal tickets, real-time cashier queues, and Stripe card payments — all in one platform. Built to replace the paper ticket booklets used in university restaurants.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-[var(--red)] hover:bg-[var(--red-dark)] transition-colors"
                >
                  Try the demo
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="https://github.com/gorkembaslik/campus-eats"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors hover:bg-[var(--surface-3)]"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
                >
                  <GithubIcon className="w-4 h-4" />
                  View on GitHub
                </a>
              </div>

              <p className="mt-4 text-xs" style={{ color: 'var(--text-3)' }}>
                No sign-up needed — demo credentials are below ↓
              </p>
            </div>

            {/* Mock order card */}
            <div className="flex justify-center md:justify-end">
              <OrderCardMock />
            </div>

          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section
        className="px-6 py-20"
        style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-1)' }}>
            Everything you'd expect. And more.
          </h2>
          <p className="text-base mb-12" style={{ color: 'var(--text-2)' }}>
            Payments, real-time updates, auth, and role-based access — all working together.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl p-6 transition-shadow hover:shadow-md"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'var(--red-light)' }}
                >
                  <Icon className="w-5 h-5 text-[var(--red)]" />
                </div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: 'var(--surface)' }}>
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-1)' }}>
            How it works
          </h2>
          <p className="text-base mb-14" style={{ color: 'var(--text-2)' }}>
            From browse to pickup in under a minute.
          </p>

          <div className="grid sm:grid-cols-3 gap-10 relative">
            {/* Connecting line */}
            <div
              className="hidden sm:block absolute top-8 left-[16.67%] right-[16.67%] h-px"
              style={{ background: 'var(--border)' }}
            />
            {steps.map(({ n, title, desc }) => (
              <div key={n}>
                <div
                  className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center mb-5 text-xl font-bold"
                  style={{ background: 'var(--red-light)', color: 'var(--red)' }}
                >
                  {n}
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo accounts ────────────────────────────────────────────── */}
      <section
        className="px-6 py-20"
        style={{ background: 'var(--red-light)', borderTop: '1px solid #ffd5cf', borderBottom: '1px solid #ffd5cf' }}
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-1)' }}>
            Try it now
          </h2>
          <p className="text-base mb-10" style={{ color: 'var(--text-2)' }}>
            Two demo accounts are ready — no sign-up required.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <DemoCard
              initials="DC"
              name="Demo Customer"
              role="customer"
              email="demo.customer@campuseats.demo"
              password="CampusCustomer1!"
              items={[
                'Place a wallet order at Shalimar (€30 balance)',
                'Pay by card using 4242 4242 4242 4242',
                'Watch your order status update live',
                'Check wallet transaction history',
              ]}
            />
            <DemoCard
              initials="DA"
              name="Demo Admin"
              role="admin"
              email="demo.admin@campuseats.demo"
              password="CampusAdmin1!"
              items={[
                'Manage menu items at /admin',
                'Watch the live order queue at /cashier',
                'Confirm pickups and top up wallets',
                'Browse the full audit log',
              ]}
            />
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold text-white bg-[var(--red)] hover:bg-[var(--red-dark)] transition-colors"
            >
              Open the demo
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Tech stack ───────────────────────────────────────────────── */}
      <section
        className="px-6 py-14"
        style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="mx-auto max-w-6xl">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-5"
            style={{ color: 'var(--text-3)' }}
          >
            Built with
          </p>
          <div className="flex flex-wrap gap-2">
            {stack.map(({ label, bg, color }) => (
              <span
                key={label}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: bg, color }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer
        className="px-6 py-8"
        style={{ background: 'var(--surface-3)' }}
      >
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-extrabold tracking-tight" style={{ color: 'var(--red)' }}>
            CampusEats
          </span>
          <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
            A full-stack portfolio project. Stripe is in test mode — no real charges occur.
          </p>
          <a
            href="https://github.com/gorkembaslik/campus-eats"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium hover:underline"
            style={{ color: 'var(--text-2)' }}
          >
            <GithubIcon className="w-3.5 h-3.5" />
            gorkembaslik/campus-eats
          </a>
        </div>
      </footer>

    </main>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OrderCardMock() {
  return (
    <div className="relative w-full max-w-xs">
      {/* Floating wallet badge */}
      <div
        className="absolute -top-3 -right-3 z-10 rounded-2xl px-4 py-3 min-w-[110px]"
        style={{ background: 'var(--red)', color: 'white', boxShadow: 'var(--shadow-md)' }}
      >
        <div className="text-xs font-medium opacity-75 mb-0.5">Wallet</div>
        <div className="text-xl font-bold leading-none">25.5 🎫</div>
        <div className="text-xs opacity-60 mt-0.5">Shalimar</div>
      </div>

      {/* Order card */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-semibold tracking-wider mb-0.5" style={{ color: 'var(--text-3)' }}>SHALIMAR</div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>#3A7F2B</div>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: '#FFF7ED', color: '#C2410C' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse inline-block" />
            Preparing
          </div>
        </div>

        {/* Items */}
        <div className="space-y-2.5 mb-4 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          {[
            { name: 'Chicken Biryani', qty: 1, price: '2.0 🎫' },
            { name: 'Lamb Karahi', qty: 1, price: '1.5 🎫' },
            { name: 'Garlic Naan', qty: 2, price: '1.0 🎫' },
          ].map(({ name, qty, price }) => (
            <div key={name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-semibold flex-shrink-0"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
                >
                  {qty}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-1)' }}>{name}</span>
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{price}</span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm" style={{ color: 'var(--text-2)' }}>Total</span>
          <span className="text-base font-bold" style={{ color: 'var(--text-1)' }}>4.5 🎫</span>
        </div>

        {/* Pickup code */}
        <div
          className="rounded-xl p-3 text-center"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Pickup code</div>
          <div
            className="text-2xl font-bold"
            style={{ color: 'var(--text-1)', letterSpacing: '0.15em' }}
          >
            37E219
          </div>
        </div>
      </div>
    </div>
  )
}

function DemoCard({
  initials, name, role, email, password, items,
}: {
  initials: string
  name: string
  role: string
  email: string
  password: string
  items: string[]
}) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{ background: 'var(--red-light)', color: 'var(--red)' }}
        >
          {initials}
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{name}</div>
          <div className="text-xs capitalize" style={{ color: 'var(--text-3)' }}>Role: {role}</div>
        </div>
      </div>

      <div className="space-y-2 mb-5">
        <Credential label="Email" value={email} />
        <Credential label="Password" value={password} />
      </div>

      <p className="text-xs font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--text-3)' }}>
        What to try
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-sm flex gap-2" style={{ color: 'var(--text-2)' }}>
            <span style={{ color: 'var(--red)', flexShrink: 0 }}>·</span>
            <span dangerouslySetInnerHTML={{ __html: item.replace(/(\/\w[\w/-]*|4242[^<]*)/g, '<code style="font-size:11px;background:#f6f6f6;padding:1px 4px;border-radius:4px">$1</code>') }} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Credential({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-2"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</span>
      <code className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{value}</code>
    </div>
  )
}
