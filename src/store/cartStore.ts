import { create } from 'zustand'
import type { PaymentMethod } from '@/types'

export interface CartItem {
  menuItemId: string
  name: string
  quantity: number
  unitPriceEur: number
  unitPriceWalletUnits: number
}

export interface AddItemParams {
  restaurantId: string
  restaurantSlug: string
  menuItemId: string
  name: string
  unitPriceEur: number
  unitPriceWalletUnits: number
}

interface CartState {
  restaurantId: string | null
  restaurantSlug: string | null
  items: CartItem[]
  paymentMethod: PaymentMethod

  addItem: (params: AddItemParams) => void
  removeItem: (menuItemId: string) => void
  updateQuantity: (menuItemId: string, quantity: number) => void
  clearCart: () => void
  setPaymentMethod: (method: PaymentMethod) => void
}

const EMPTY_CART = {
  restaurantId: null,
  restaurantSlug: null,
  items: [],
  paymentMethod: 'wallet' as PaymentMethod,
}

export const useCartStore = create<CartState>()((set, get) => ({
  ...EMPTY_CART,

  addItem(params) {
    const { restaurantId, restaurantSlug, menuItemId, name, unitPriceEur, unitPriceWalletUnits } =
      params
    const state = get()

    // Different restaurant — caller must clear the cart first (see MenuCard modal)
    if (state.restaurantId !== null && state.restaurantId !== restaurantId) return

    set((s) => {
      const existing = s.items.find((i) => i.menuItemId === menuItemId)

      const items = existing
        ? s.items.map((i) =>
            i.menuItemId === menuItemId ? { ...i, quantity: i.quantity + 1 } : i
          )
        : [
            ...s.items,
            { menuItemId, name, quantity: 1, unitPriceEur, unitPriceWalletUnits },
          ]

      return {
        restaurantId,
        restaurantSlug,
        items,
      }
    })
  },

  removeItem(menuItemId) {
    set((s) => {
      const items = s.items.filter((i) => i.menuItemId !== menuItemId)
      return items.length === 0 ? { ...EMPTY_CART, paymentMethod: s.paymentMethod } : { items }
    })
  },

  updateQuantity(menuItemId, quantity) {
    if (quantity <= 0) {
      get().removeItem(menuItemId)
      return
    }
    set((s) => ({
      items: s.items.map((i) =>
        i.menuItemId === menuItemId ? { ...i, quantity } : i
      ),
    }))
  },

  clearCart() {
    set({ ...EMPTY_CART })
  },

  setPaymentMethod(method) {
    set({ paymentMethod: method })
  },
}))

// Derived selectors — call these outside the store to avoid re-render on every keystroke
export function selectTotalEur(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.unitPriceEur * i.quantity, 0)
}

export function selectNTickets(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.unitPriceWalletUnits * i.quantity, 0)
}

export function selectItemCount(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0)
}

export function selectMenuUrl(restaurantSlug: string | null): string | null {
  return restaurantSlug ? `/${restaurantSlug}/menu` : null
}
