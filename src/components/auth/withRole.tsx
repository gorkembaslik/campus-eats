'use client'

import { useEffect, type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import type { Role } from '@/types'

export function withRole<P extends object>(
  allowedRoles: Role[],
  Component: ComponentType<P>
) {
  return function RoleGuard(props: P) {
    const { user, role, loading } = useUser()
    const router = useRouter()

    useEffect(() => {
      if (loading) return
      if (!user) {
        router.replace('/login')
        return
      }
      if (role && !allowedRoles.includes(role)) {
        router.replace('/unauthorized')
      }
    }, [loading, user, role, router])

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[var(--red)] border-t-transparent rounded-full animate-spin" />
        </div>
      )
    }

    if (!user || (role && !allowedRoles.includes(role))) {
      return null
    }

    return <Component {...props} />
  }
}
