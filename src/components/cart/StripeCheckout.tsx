'use client'

import { useEffect, useRef, useState } from 'react'
import {
  loadStripe,
  type Stripe,
  type StripeElements,
  type StripePaymentElement,
} from '@stripe/stripe-js'
import { Loader2, Lock, ChevronLeft, AlertCircle } from 'lucide-react'

// ── Stripe singleton ──────────────────────────────────────────────────────────
// Initialised once at module level so the JS SDK is fetched only once,
// regardless of how many times this component mounts.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StripeCheckoutProps {
  clientSecret: string
  orderId: string
  onBack?: () => void
  onSuccess: (orderId: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StripeCheckout({ clientSecret, orderId, onBack, onSuccess }: StripeCheckoutProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  // Keep Stripe instances in refs — updating them never needs a re-render
  const stripeRef = useRef<Stripe | null>(null)
  const elementsRef = useRef<StripeElements | null>(null)

  const [elementReady, setElementReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Mount Payment Element ─────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    let paymentEl: StripePaymentElement | null = null

    async function init() {
      const stripe = await stripePromise
      if (!alive || !stripe || !mountRef.current) return

      stripeRef.current = stripe

      const elements = stripe.elements({
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#FF3008',
            colorBackground: '#ffffff',
            colorText: '#111827',
            colorDanger: '#FF3008',
            colorTextPlaceholder: '#9ca3af',
            fontSizeBase: '14px',
            borderRadius: '12px',
          },
          rules: {
            '.Input': {
              border: '1px solid #e5e7eb',
              boxShadow: 'none',
            },
            '.Input:focus': {
              border: '1px solid #FF3008',
              boxShadow: '0 0 0 3px rgba(255,48,8,0.15)',
              outline: 'none',
            },
          },
        },
      })

      elementsRef.current = elements

      paymentEl = elements.create('payment', {
        layout: 'tabs',
      })

      paymentEl.on('ready', () => {
        if (alive) setElementReady(true)
      })

      paymentEl.on('change', () => {
        // Clear stale errors as the user edits their details
        if (alive) setError(null)
      })

      paymentEl.mount(mountRef.current)
    }

    init()

    return () => {
      alive = false
      paymentEl?.unmount()
    }
    // clientSecret is stable for the lifetime of this checkout session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSecret])

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const stripe = stripeRef.current
    const elements = elementsRef.current
    if (!stripe || !elements || submitting) return

    setSubmitting(true)
    setError(null)

    // redirect: 'if_required' keeps control in JS when no 3DS redirect is needed.
    // When 3DS IS required, Stripe redirects to return_url automatically, then
    // the /order/[orderId] page reads the ?redirect_status param from the URL.
    const { paymentIntent, error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order/${orderId}`,
      },
      redirect: 'if_required',
    })

    if (confirmError) {
      // Stripe only surfaces user-actionable messages here
      setError(confirmError.message ?? 'Payment failed. Please check your details and try again.')
      setSubmitting(false)
      return
    }

    // Manual-capture intents land in 'requires_capture', not 'succeeded'.
    // Call /authorize to move the order to 'pending' in our DB synchronously — this is the
    // primary path so the cashier sees the order immediately without waiting for the webhook.
    if (paymentIntent?.status === 'requires_capture' || paymentIntent?.status === 'succeeded') {
      try {
        await fetch(`/api/orders/${orderId}/authorize`, { method: 'POST' })
      } catch {
        // Best-effort: the Stripe webhook is the fallback if this fails
      }
      onSuccess(orderId)
      return
    }

    // Unexpected status — surface it so it doesn't silently fail
    setError(`Unexpected payment status: ${paymentIntent?.status ?? 'unknown'}. Contact support.`)
    setSubmitting(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="p-1.5 -ml-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <h2 className="text-base font-semibold text-gray-900">Complete payment</h2>
          <p className="text-xs text-gray-400">Secured by Stripe</p>
        </div>
        <Lock className="w-4 h-4 text-gray-300 ml-auto" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
        <div className="flex-1 px-4 py-5 space-y-5">
          {/* Stripe Payment Element mount point */}
          <div
            ref={mountRef}
            className={elementReady ? undefined : 'hidden'}
            aria-label="Card details"
          />

          {/* Loading skeleton shown until element fires 'ready' */}
          {!elementReady && <PaymentElementSkeleton />}

          {/* Stripe error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-100 px-3.5 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="px-4 py-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={!elementReady || submitting}
            className="w-full flex items-center justify-center gap-2 bg-[var(--red)] hover:bg-[var(--red-dark)] active:bg-[var(--red-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-3 transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Pay now
              </>
            )}
          </button>
          <p className="mt-2.5 text-center text-xs text-gray-400">
            Your card will be held and only charged when you collect your order.
          </p>
        </div>
      </form>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PaymentElementSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-hidden>
      {/* Tab row */}
      <div className="flex gap-2">
        <div className="h-10 flex-1 bg-gray-100 rounded-xl" />
        <div className="h-10 flex-1 bg-gray-100 rounded-xl" />
      </div>
      {/* Card number */}
      <div className="h-10 bg-gray-100 rounded-xl" />
      {/* Expiry + CVC */}
      <div className="flex gap-2">
        <div className="h-10 flex-1 bg-gray-100 rounded-xl" />
        <div className="h-10 flex-1 bg-gray-100 rounded-xl" />
      </div>
      {/* Name */}
      <div className="h-10 bg-gray-100 rounded-xl" />
    </div>
  )
}
