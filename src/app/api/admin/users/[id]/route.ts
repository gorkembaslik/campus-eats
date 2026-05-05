import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Role } from '@/types'

function createUserClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// PATCH /api/admin/users/[id]
// Body: { role: 'customer' | 'cashier' | 'admin' }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userClient = createUserClient()
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (params.id === user.id) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const newRole = body?.role as Role | undefined
  if (!newRole || !['customer', 'cashier', 'admin'].includes(newRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Fetch target's current role
  const { data: target } = await db.from('users').select('role').eq('id', params.id).maybeSingle()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Last-admin guard: prevent removing the sole admin
  if (target.role === 'admin' && newRole !== 'admin') {
    const { count } = await db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 409 })
    }
  }

  const { error } = await db.from('users').update({ role: newRole }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
