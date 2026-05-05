'use client'

import Link from 'next/link'
import { BookOpen, ClipboardList, Users } from 'lucide-react'
import { withRole } from '@/components/auth/withRole'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { useUser } from '@/hooks/useUser'

const CARDS = [
  {
    href: '/admin/menu',
    icon: BookOpen,
    title: 'Menu management',
    description: 'Add, edit, and remove menu items. Toggle availability and set ticket prices.',
    cta: 'Manage menu',
  },
  {
    href: '/admin/audit',
    icon: ClipboardList,
    title: 'Audit log',
    description: 'Review all wallet credits issued by cashiers. Filter by date, restaurant, or cashier.',
    cta: 'View credits',
  },
  {
    href: '/admin/users',
    icon: Users,
    title: 'User management',
    description: 'Change user roles between customer, cashier, and admin.',
    cta: 'Manage users',
  },
]

function AdminPage() {
  const { user } = useUser()

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader
        title="Admin"
        subtitle={user?.full_name ? `Logged in as ${user.full_name}` : undefined}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.href}
                href={card.href}
                className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-4 hover:shadow-md transition-shadow group"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                    {card.title}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">{card.description}</p>
                </div>
                <span className="text-sm font-semibold text-orange-500 group-hover:underline">
                  {card.cta} →
                </span>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}

export default withRole(['admin'], AdminPage)
