'use client'

import { useCartStore } from '@/store/cartStore'

interface Props {
  children: React.ReactNode
  restaurantId: string
}

export function MenuLayoutShift({ children, restaurantId }: Props) {
  const items = useCartStore((s) => s.items)
  const cartRestaurantId = useCartStore((s) => s.restaurantId)
  const hasCart = items.length > 0 && cartRestaurantId === restaurantId

  return (
    <div
      className={[
        'transition-[padding-right] duration-300 ease-in-out',
        hasCart ? 'md:pr-[380px]' : 'md:pr-0',
      ].join(' ')}
    >
      {children}
    </div>
  )
}
