'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Role, UserProfile } from '@/types'

interface UseUserResult {
  user: UserProfile | null
  role: Role | null
  loading: boolean
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchProfile(userId: string) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      setUser(data ?? null)
      setLoading(false)
    }

    // Get the current session synchronously from the cache, then subscribe
    // to auth changes so the hook stays in sync on login/logout.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setUser(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, role: user?.role ?? null, loading }
}
