'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { withRole } from '@/components/auth/withRole'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Modal } from '@/components/admin/Modal'
import { useUser } from '@/hooks/useUser'
import type { AdminUserRow, Role } from '@/types'

const ROLES: Role[] = ['customer', 'cashier', 'admin']

function UsersPage() {
  const { user: me } = useUser()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [confirmElevation, setConfirmElevation] = useState<{
    id: string; full_name: string | null; from: Role; to: Role
  } | null>(null)
  const updatingRef = useRef<Set<string>>(new Set())
  const [, forceUpdate] = useState(0)

  const fetchUsers = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users?page=${p}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to load users'); return }
      setUsers(data.rows ?? [])
      setTotal(data.total ?? 0)
      setPage(p)
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers(1) }, [fetchUsers])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        (u.full_name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q)
    )
  }, [users, search])

  async function applyRoleChange(id: string, oldRole: Role, newRole: Role) {
    updatingRef.current.add(id)
    forceUpdate((n) => n + 1)
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: newRole } : u))

    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    updatingRef.current.delete(id)
    forceUpdate((n) => n + 1)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: oldRole } : u))
      toast.error(body.error ?? 'Could not change role')
      return
    }
    toast.success('Role updated')
  }

  function handleRoleChange(u: AdminUserRow, newRole: Role) {
    if (newRole === u.role) return
    if (newRole === 'admin' && u.role !== 'admin') {
      setConfirmElevation({ id: u.id, full_name: u.full_name, from: u.role, to: newRole })
      return
    }
    applyRoleChange(u.id, u.role, newRole)
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader backHref="/admin" title="User management" subtitle={`${total} user${total !== 1 ? 's' : ''}`} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th>Joined</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((u) => {
                    const isMe = u.id === me?.id
                    const isUpdating = updatingRef.current.has(u.id)
                    return (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{u.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{u.email ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={u.role}
                              disabled={isMe || isUpdating}
                              onChange={(e) => handleRoleChange(u, e.target.value as Role)}
                              className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                            {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                            {isMe && <span className="text-xs text-gray-400">(you)</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">No users match your search.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => fetchUsers(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Prev
            </button>
            <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
            <button
              onClick={() => fetchUsers(page + 1)}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </main>

      {/* Elevation confirm modal */}
      <Modal
        open={!!confirmElevation}
        onClose={() => setConfirmElevation(null)}
        title="Grant admin access?"
        footer={
          <>
            <button
              onClick={() => setConfirmElevation(null)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!confirmElevation) return
                applyRoleChange(confirmElevation.id, confirmElevation.from, confirmElevation.to)
                setConfirmElevation(null)
              }}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
            >
              Grant admin
            </button>
          </>
        }
      >
        <div className="px-5 py-5">
          <p className="text-sm text-gray-700">
            You are about to grant admin access to{' '}
            <strong>{confirmElevation?.full_name ?? 'this user'}</strong>.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Admins can manage the menu, view the audit log, and change user roles. This cannot be undone from here.
          </p>
        </div>
      </Modal>
    </div>
  )
}

export default withRole(['admin'], UsersPage)

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
      {children}
    </th>
  )
}
