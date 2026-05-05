'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Wallet, LogOut, Menu, X, ChevronDown, UtensilsCrossed, Receipt, Shield } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'

export function TopNav() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, role, loading } = useUser()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isAuthPage = pathname === '/login' || pathname === '/signup'

  // Close dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // Close both menus on route change
  useEffect(() => {
    setMobileOpen(false)
    setDropdownOpen(false)
  }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = user?.full_name
    ? user.full_name
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  return (
    <header
      className="sticky top-0 z-50 bg-white"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Logo */}
          <Link
            href={user ? '/dashboard' : '/login'}
            className="text-xl font-extrabold tracking-tight text-[var(--red)] select-none"
          >
            CampusEats
          </Link>

          {/* ── Desktop right side ─────────────────────────────────────── */}
          <div className="hidden sm:flex items-center gap-3">
            {loading ? (
              <div className="w-5 h-5 border-2 border-[var(--red)] border-t-transparent rounded-full animate-spin" />
            ) : user ? (
              <div className="relative" ref={dropdownRef}>
                {/* Avatar button */}
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex items-center gap-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--red)] focus-visible:ring-offset-2"
                  aria-haspopup="true"
                  aria-expanded={dropdownOpen}
                >
                  <div className="h-8 w-8 rounded-full bg-[var(--red-light)] flex items-center justify-center text-[var(--red)] font-bold text-sm select-none">
                    {initials}
                  </div>
                  <ChevronDown
                    className={[
                      'w-3.5 h-3.5 text-[var(--text-3)] transition-transform duration-150',
                      dropdownOpen ? 'rotate-180' : '',
                    ].join(' ')}
                  />
                </button>

                {/* Dropdown */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl border border-[var(--border)] shadow-lg overflow-hidden z-50">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-[var(--border)]">
                      <p className="text-sm font-semibold text-[var(--text-1)] truncate">
                        {user.full_name ?? 'User'}
                      </p>
                      <p className="text-xs text-[var(--text-3)] mt-0.5 capitalize">{role}</p>
                    </div>

                    {/* Actions */}
                    <div className="py-1">
                      <Link
                        href="/dashboard/wallet"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition-colors"
                      >
                        <Wallet className="w-4 h-4" />
                        My Wallet
                      </Link>
                      <Link
                        href="/dashboard/orders"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition-colors"
                      >
                        <Receipt className="w-4 h-4" />
                        Order history
                      </Link>
                      {(role === 'cashier' || role === 'admin') && (
                        <Link
                          href="/cashier"
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition-colors"
                        >
                          <UtensilsCrossed className="w-4 h-4" />
                          Cashier
                        </Link>
                      )}
                      {role === 'admin' && (
                        <Link
                          href="/admin"
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition-colors"
                        >
                          <Shield className="w-4 h-4" />
                          Admin
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : !isAuthPage ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-sm font-medium text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="text-sm font-semibold px-4 py-2 rounded-xl text-white bg-[var(--red)] hover:bg-[var(--red-dark)] transition-colors"
                >
                  Sign up
                </Link>
              </div>
            ) : null}
          </div>

          {/* ── Mobile hamburger ──────────────────────────────────────── */}
          <button
            className="sm:hidden p-2 rounded-lg text-[var(--text-2)] hover:bg-[var(--surface-2)] transition-colors"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown ───────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-[var(--border)] bg-white px-4 py-4 space-y-1">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-[var(--red)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : user ? (
            <>
              {/* User info row */}
              <div className="flex items-center gap-3 pb-3 mb-1 border-b border-[var(--border)]">
                <div className="h-10 w-10 rounded-full bg-[var(--red-light)] flex items-center justify-center text-[var(--red)] font-bold text-base select-none flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-1)] truncate">
                    {user.full_name ?? 'User'}
                  </p>
                  <p className="text-xs text-[var(--text-3)] capitalize">{role}</p>
                </div>
              </div>

              <Link
                href="/dashboard"
                className="flex items-center h-10 text-sm font-medium text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/wallet"
                className="flex items-center h-10 text-sm font-medium text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
              >
                My Wallet
              </Link>
              <Link
                href="/dashboard/orders"
                className="flex items-center h-10 text-sm font-medium text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
              >
                Order history
              </Link>
              {(role === 'cashier' || role === 'admin') && (
                <Link
                  href="/cashier"
                  className="flex items-center h-10 text-sm font-medium text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
                >
                  Cashier
                </Link>
              )}
              {role === 'admin' && (
                <Link
                  href="/admin"
                  className="flex items-center h-10 text-sm font-medium text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
                >
                  Admin
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center h-10 w-full text-left text-sm font-medium text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
              >
                Logout
              </button>
            </>
          ) : !isAuthPage ? (
            <>
              <Link
                href="/login"
                className="flex items-center h-10 text-sm font-medium text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="flex items-center justify-center h-10 rounded-xl text-sm font-semibold text-white bg-[var(--red)] hover:bg-[var(--red-dark)] transition-colors"
              >
                Sign up
              </Link>
            </>
          ) : null}
        </div>
      )}
    </header>
  )
}
