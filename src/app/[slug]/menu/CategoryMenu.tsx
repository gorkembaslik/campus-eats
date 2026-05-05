'use client'

import { useEffect, useRef, useState } from 'react'
import type { MenuItem } from '@/types'
import { MenuCard } from './MenuCard'

interface Props {
  grouped: Record<string, MenuItem[]>
  categories: string[]
  ticketEurValue: number
  restaurantId: string
  restaurantSlug: string
}

export function CategoryMenu({
  grouped,
  categories,
  ticketEurValue,
  restaurantId,
  restaurantSlug,
}: Props) {
  const [activeCategory, setActiveCategory] = useState(categories[0] ?? '')
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const observerRef = useRef<IntersectionObserver | null>(null)
  const isScrollingToRef = useRef(false)

  // Scroll active tab into view when it changes
  useEffect(() => {
    const btn = tabRefs.current[activeCategory]
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeCategory])

  // IntersectionObserver — highlight tab for section in view
  useEffect(() => {
    observerRef.current?.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (isScrollingToRef.current) return
        // Pick the topmost intersecting section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveCategory(visible[0].target.id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )

    categories.forEach((cat) => {
      const el = sectionRefs.current[cat]
      if (el) observerRef.current!.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [categories])

  function scrollToCategory(cat: string) {
    const el = sectionRefs.current[cat]
    if (!el) return
    isScrollingToRef.current = true
    setActiveCategory(cat)
    // offset for sticky TopNav (4rem = 64px) + tab bar (~45px) + small gap
    const top = el.getBoundingClientRect().top + window.scrollY - 64 - 45 - 8
    window.scrollTo({ top, behavior: 'smooth' })
    setTimeout(() => { isScrollingToRef.current = false }, 800)
  }

  if (categories.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-base font-medium text-[var(--text-3)]">No items available right now.</p>
        <p className="text-sm text-[var(--text-3)] mt-1">Check back later.</p>
      </div>
    )
  }

  return (
    <>
      {/* ── Sticky category tab bar ──────────────────────────────────── */}
      <div className="sticky top-16 z-30 bg-white border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 overflow-x-auto scrollbar-hide">
          <div className="flex">
            {categories.map((cat) => {
              const isActive = cat === activeCategory
              return (
                <button
                  key={cat}
                  ref={(el) => { tabRefs.current[cat] = el }}
                  onClick={() => scrollToCategory(cat)}
                  className={[
                    'relative px-4 py-3 text-sm font-semibold flex-shrink-0 transition-colors',
                    isActive ? 'text-[var(--red)]' : 'text-[var(--text-2)] hover:text-[var(--text-1)]',
                  ].join(' ')}
                >
                  {cat}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--red)]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Item sections ─────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 pb-28 md:pb-8 space-y-8">
        {categories.map((cat) => (
          <div
            key={cat}
            id={cat}
            ref={(el) => { sectionRefs.current[cat] = el }}
          >
            <h2 className="text-xs font-bold tracking-widest text-[var(--text-3)] uppercase mb-3">
              {cat}
            </h2>
            <div className="space-y-3">
              {grouped[cat].map((item) => (
                <MenuCard
                  key={item.id}
                  item={item}
                  ticketEurValue={ticketEurValue}
                  restaurantId={restaurantId}
                  restaurantSlug={restaurantSlug}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
