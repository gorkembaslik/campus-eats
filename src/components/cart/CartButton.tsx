'use client'

import { useState } from 'react'
import { ShoppingCart, ArrowRight } from 'lucide-react'
import { useCartStore, selectItemCount, selectTotalEur } from '@/store/cartStore'
import { CartSidebar } from '@/components/cart/CartSidebar'

interface Props {
  restaurantId: string
}

export function CartButton({ restaurantId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const items = useCartStore((s) => s.items)
  const cartRestaurantId = useCartStore((s) => s.restaurantId)
  const count = selectItemCount(items)
  const totalEur = selectTotalEur(items)

  const isThisRestaurant = cartRestaurantId === restaurantId

  return (
    <>
      {/*
        Mobile cart bar — full-width sticky bottom bar, hidden on desktop.
        Desktop uses the CartSidebar auto-expanding panel instead.
        pb-4 + gradient fade gives a sense of floating above the page content.
      */}
      {count > 0 && isThisRestaurant && (
        <div className="fixed bottom-0 inset-x-0 z-40 md:hidden px-4 pb-4 pt-3 bg-gradient-to-t from-[var(--surface-2)] via-[var(--surface-2)]/90 to-transparent pointer-events-none">
          <button
            onClick={() => setIsOpen(true)}
            className="w-full flex items-center gap-3 bg-[var(--red)] hover:bg-[var(--red-dark)] active:bg-[var(--red-dark)] text-white rounded-2xl px-4 py-3.5 shadow-lg shadow-red-900/20 transition-colors pointer-events-auto"
            aria-label={`View cart — ${count} item${count !== 1 ? 's' : ''}, €${totalEur.toFixed(2)}`}
          >
            {/* Cart icon in a frosted pill */}
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>

            {/* Item count */}
            <span className="flex-1 text-sm font-bold text-left">
              {count} item{count !== 1 ? 's' : ''}
            </span>

            {/* Total */}
            <span className="text-sm font-bold">€{totalEur.toFixed(2)}</span>

            {/* CTA */}
            <div className="flex items-center gap-1 ml-2 text-sm font-semibold">
              View Cart
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* CartSidebar is always mounted — desktop auto-shows when cart non-empty */}
      <CartSidebar isOpen={isOpen} onClose={() => setIsOpen(false)} currentRestaurantId={restaurantId} />
    </>
  )
}
