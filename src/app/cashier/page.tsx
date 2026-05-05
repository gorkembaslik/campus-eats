import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CashierDashboardClient } from './CashierDashboardClient'

export const dynamic = 'force-dynamic'

export default async function CashierPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/cashier')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'cashier' && profile?.role !== 'admin') {
    redirect('/unauthorized')
  }

  // Public read — anon client is fine for restaurants.
  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, name, currency_label, ticket_eur_value')
    .eq('is_active', true)
    .order('name')

  return (
    <CashierDashboardClient
      restaurants={restaurants ?? []}
    />
  )
}
