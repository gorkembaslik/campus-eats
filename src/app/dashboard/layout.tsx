export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--surface-2)]">
      {children}
    </div>
  )
}
