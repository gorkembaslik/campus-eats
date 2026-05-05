export default function CashierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--surface-2)]">
      {children}
    </div>
  )
}
