import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CashierCreditClient } from './CashierCreditClient'
import type { DenominationMap } from '@/types'

export const dynamic = 'force-dynamic'

export default async function CashierCreditPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/cashier/credit')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'cashier' && profile?.role !== 'admin') {
    redirect('/unauthorized')
  }

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, name, currency_label, ticket_denominations')
    .eq('is_active', true)
    .order('name')

  const mapped = (restaurants ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    currency_label: r.currency_label as string,
    ticket_denominations: (r.ticket_denominations ?? { '1-1': 0.5, '1-4': 1.0 }) as DenominationMap,
  }))

  return <CashierCreditClient restaurants={mapped} />
}
