'use client'

import { useState } from 'react'
import { Plus, Minus, Ticket } from 'lucide-react'
import { useCartStore, type AddItemParams } from '@/store/cartStore'
import type { MenuItem } from '@/types'

interface Props {
  item: MenuItem
  ticketEurValue: number
  restaurantId: string
  restaurantSlug: string
}

export function MenuCard({ item, ticketEurValue, restaurantId, restaurantSlug }: Props) {
  const quantity = useCartStore(
    (s) => s.items.find((i) => i.menuItemId === item.id)?.quantity ?? 0
  )
  const cartRestaurantId = useCartStore((s) => s.restaurantId)
  const addItem = useCartStore((s) => s.addItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const updateQuantity = useCartStore((s) => s.updateQuantity)

  const [pendingParams, setPendingParams] = useState<AddItemParams | null>(null)

  function buildParams(): AddItemParams {
    return {
      restaurantId,
      restaurantSlug,
      menuItemId: item.id,
      name: item.name,
      unitPriceEur: item.price_eur,
      unitPriceWalletUnits: item.price_wallet_units > 0
        ? item.price_wallet_units
        : ticketEurValue > 0 ? item.price_eur / ticketEurValue : 0,
    }
  }

  function handleAdd() {
    const params = buildParams()
    if (cartRestaurantId !== null && cartRestaurantId !== restaurantId) {
      setPendingParams(params)
      return
    }
    addItem(params)
  }

  function handleConfirmSwitch() {
    if (!pendingParams) return
    clearCart()
    addItem(pendingParams)
    setPendingParams(null)
  }

  function handleDecrement() {
    updateQuantity(item.id, quantity - 1)
  }

  return (
    <>
    <div
      className="flex items-start gap-4 p-4 bg-white"
      style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}
    >
      {/* ── Left: item info ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 py-0.5">
        <h2 className="text-sm font-bold text-[var(--text-1)] leading-snug">
          {item.name}
        </h2>

        {item.description && (
          <p
            className="mt-1 text-xs leading-relaxed text-[var(--text-2)]"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }}
          >
            {item.description}
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[var(--text-1)]">
            €{item.price_eur.toFixed(2)}
          </span>
          {item.price_wallet_units > 0 && (
            <>
              <span className="text-[var(--border)] text-xs" aria-hidden>·</span>
              <span className="text-xs text-[var(--text-3)] flex items-center gap-0.5">
                <Ticket className="w-3 h-3" />
                {item.price_wallet_units.toFixed(2)}
              </span>
            </>
          )}
        </div>
      </div>

      {/*
        ── Right: 80×80 image + controls ────────────────────────────────
        paddingBottom reserves space for the controls so they don't clip
        the card body. Controls are absolute at bottom-0, centred under
        the image, partially overlapping the image bottom edge.
      */}
      <div
        className="relative flex-shrink-0 self-start"
        style={{ width: 80, paddingBottom: 14 }}
      >
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-[var(--surface-3)]">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span
                className="text-2xl font-extrabold select-none"
                style={{ color: 'var(--border)' }}
              >
                {item.name[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Add / quantity controls — centred at bottom, overlaps image bottom */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center">
          {quantity === 0 ? (
            <button
              onClick={handleAdd}
              className="w-9 h-9 rounded-full bg-[var(--red)] flex items-center justify-center text-white shadow-md hover:bg-[var(--red-dark)] active:bg-[var(--red-dark)] transition-colors"
              aria-label={`Add ${item.name} to cart`}
            >
              <Plus className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center h-9 bg-[var(--red)] rounded-full text-white shadow-md overflow-hidden">
              <button
                onClick={handleDecrement}
                className="w-9 h-9 flex items-center justify-center hover:opacity-80 active:opacity-60 transition-opacity"
                aria-label="Remove one"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span
                className="w-5 text-center text-xs font-bold tabular-nums select-none"
                aria-live="polite"
                aria-label={`${quantity} in cart`}
              >
                {quantity}
              </span>
              <button
                onClick={handleAdd}
                className="w-9 h-9 flex items-center justify-center hover:opacity-80 active:opacity-60 transition-opacity"
                aria-label="Add one more"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ── Restaurant-switch confirmation modal ──────────────────── */}
    {pendingParams && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={() => setPendingParams(null)}
      >
        <div
          className="w-full max-w-sm bg-white p-6 flex flex-col gap-4"
          style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-[var(--text-1)]">Start a new order?</h3>
            <p className="text-sm text-[var(--text-2)] leading-relaxed">
              Your cart contains items from another restaurant. Starting a new order will clear your current cart.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleConfirmSwitch}
              className="w-full py-3 rounded-xl bg-[var(--red)] hover:bg-[var(--red-dark)] text-white text-sm font-semibold transition-colors"
            >
              Clear cart &amp; add item
            </button>
            <button
              onClick={() => setPendingParams(null)}
              className="w-full py-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-1)] text-sm font-semibold transition-colors"
            >
              Keep current cart
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
