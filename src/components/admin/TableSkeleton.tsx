export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-gray-50 last:border-0">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-40 bg-gray-200 rounded" />
            <div className="h-3 w-56 bg-gray-100 rounded" />
          </div>
          <div className="h-3.5 w-12 bg-gray-100 rounded" />
          <div className="h-3.5 w-12 bg-gray-100 rounded" />
          <div className="h-6 w-20 bg-gray-100 rounded-full" />
          <div className="w-7 h-7 bg-gray-100 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
