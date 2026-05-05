'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

const inputClass =
  'w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-1)] placeholder-[var(--text-3)] transition-colors focus:border-[var(--red)] focus:outline-none focus:ring-2 focus:ring-[var(--red)]/20'

const labelClass = 'block text-sm font-medium text-[var(--text-2)] mb-1.5'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard')
      } else {
        setChecking(false)
      }
    })
  }, [router])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    const next = searchParams.get('next') ?? '/dashboard'
    router.push(next)
    router.refresh()
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--red)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">

      {/* Card */}
      <div
        className="bg-white border border-[var(--border)] rounded-2xl p-8"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        {/* Logo */}
        <div className="text-center mb-7">
          <p className="text-2xl font-extrabold tracking-tight text-[var(--red)] select-none">
            CampusEats
          </p>
          <h1 className="mt-4 text-xl font-bold text-[var(--text-1)]">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="jane@university.edu"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={handleChange}
              placeholder="Your password"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-[var(--radius-sm)] bg-[var(--red)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--red-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--red)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in…
              </span>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>

      {/* Switch page link */}
      <p className="mt-5 text-center text-sm text-[var(--text-3)]">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-semibold text-[var(--text-1)] hover:text-[var(--red)] transition-colors"
        >
          Sign up
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
