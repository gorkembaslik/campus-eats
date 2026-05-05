'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

const inputClass =
  'w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-1)] placeholder-[var(--text-3)] transition-colors focus:border-[var(--red)] focus:outline-none focus:ring-2 focus:ring-[var(--red)]/20'

const labelClass = 'block text-sm font-medium text-[var(--text-2)] mb-1.5'

export default function SignUpPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName },
      },
    })

    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    if (data.user && !data.session) {
      toast.error('An account with this email already exists. Please log in.')
      router.push('/login')
      return
    }

    toast.success('Check your email to confirm your account.')
    router.push('/login')
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
            Create an account
          </h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            Sign up to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className={labelClass}>
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              value={form.fullName}
              onChange={handleChange}
              placeholder="Jane Doe"
              className={inputClass}
            />
          </div>

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
              autoComplete="new-password"
              required
              minLength={6}
              value={form.password}
              onChange={handleChange}
              placeholder="At least 6 characters"
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
                Creating account…
              </span>
            ) : (
              'Create account'
            )}
          </button>
        </form>
      </div>

      {/* Switch page link */}
      <p className="mt-5 text-center text-sm text-[var(--text-3)]">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold text-[var(--text-1)] hover:text-[var(--red)] transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
