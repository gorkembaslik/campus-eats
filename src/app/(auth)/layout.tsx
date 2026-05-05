export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[var(--surface-2)] px-4 py-12">
      {/* Thin red accent stripe pinned to the very top of the viewport */}
      <div
        className="fixed top-0 inset-x-0 z-[60] h-1 bg-[var(--red)]"
        aria-hidden
      />
      {children}
    </main>
  )
}
