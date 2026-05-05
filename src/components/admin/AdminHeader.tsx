import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export function AdminHeader({
  backHref,
  backLabel = 'Admin',
  title,
  subtitle,
  actions,
}: {
  backHref?: string
  backLabel?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {backHref && (
              <Link
                href={backHref}
                className="flex-shrink-0 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 truncate">{title}</h1>
              {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  )
}
