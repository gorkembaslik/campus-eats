import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-sm">
        <p className="text-5xl font-extrabold text-orange-500">403</p>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Access denied</h1>
        <p className="mt-2 text-sm text-gray-500">
          You don&apos;t have permission to view this page. If you think this is a
          mistake, contact your administrator.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  )
}
