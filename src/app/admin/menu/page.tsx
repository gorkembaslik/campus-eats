'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Plus,
  Pencil,
  Loader2,
  ImageOff,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { withRole } from '@/components/auth/withRole'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Field } from '@/components/admin/Field'
import { inputCls } from '@/components/admin/Input'
import { Modal } from '@/components/admin/Modal'
import { TableSkeleton } from '@/components/admin/TableSkeleton'
import { EmptyState } from '@/components/admin/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminMenuItem {
  id: string
  name: string
  description: string | null
  image_url: string | null
  price_eur: number
  price_wallet_units: number
  available: boolean
  restaurant_id: string
}

interface RestaurantRow {
  id: string
  name: string
  currency_label: string
}

interface FormState {
  name: string
  description: string
  price_eur: string
  price_wallet_units: string
  image_url: string
  available: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  price_eur: '',
  price_wallet_units: '',
  image_url: '',
  available: true,
}

function itemToForm(item: AdminMenuItem): FormState {
  return {
    name: item.name,
    description: item.description ?? '',
    price_eur: item.price_eur.toFixed(2),
    price_wallet_units: item.price_wallet_units.toFixed(2),
    image_url: item.image_url ?? '',
    available: item.available,
  }
}

function validate(form: FormState): string | null {
  if (!form.name.trim()) return 'Name is required.'

  const eur = parseFloat(form.price_eur)
  if (isNaN(eur) || eur <= 0) return 'Price (€) must be a positive number.'

  const wallet = parseFloat(form.price_wallet_units)
  if (isNaN(wallet) || wallet < 0) return 'Ticket equivalent must be 0 or a positive number.'

  if (wallet > 0 && Math.round(wallet * 10) % 5 !== 0) {
    return 'Ticket equivalent must be a multiple of 0.5 (e.g. 0.5, 1, 1.5).'
  }

  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

function AdminMenuPage() {
  const supabase = createClient()

  const [restaurant, setRestaurant] = useState<RestaurantRow | null>(null)
  const [items, setItems] = useState<AdminMenuItem[]>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Track in-flight availability toggles so the button shows a spinner
  const togglingRef = useRef<Set<string>>(new Set())
  const [, forceUpdate] = useState(0)

  // ── Data fetch ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const [{ data: restData }, { data: itemsData }] = await Promise.all([
        supabase
          .from('restaurants')
          .select('id, name, currency_label')
          .limit(1)
          .single(),
        supabase
          .from('menu_items')
          .select('id, name, description, image_url, price_eur, price_wallet_units, available, restaurant_id')
          .is('deleted_at', null)
          .order('name'),
      ])

      if (restData) setRestaurant(restData as RestaurantRow)
      setItems((itemsData as AdminMenuItem[]) ?? [])
      setLoading(false)
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(item: AdminMenuItem) {
    setEditingId(item.id)
    setForm(itemToForm(item))
    setFormError(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
  }

  async function toggleAvailability(item: AdminMenuItem) {
    if (togglingRef.current.has(item.id)) return
    togglingRef.current.add(item.id)
    forceUpdate((n) => n + 1)

    const next = !item.available
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, available: next } : i))
    )

    const { error } = await supabase
      .from('menu_items')
      .update({ available: next })
      .eq('id', item.id)

    if (error) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, available: !next } : i))
      )
      toast.error('Could not update availability.')
    } else {
      toast.success(next ? 'Item marked available.' : 'Item hidden from menu.')
    }

    togglingRef.current.delete(item.id)
    forceUpdate((n) => n + 1)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant) return

    const error = validate(form)
    if (error) {
      setFormError(error)
      return
    }

    setSaving(true)
    setFormError(null)

    const payload = {
      ...(editingId ? { id: editingId } : {}),
      restaurant_id: restaurant.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_eur: parseFloat(parseFloat(form.price_eur).toFixed(2)),
      price_wallet_units: parseFloat(parseFloat(form.price_wallet_units).toFixed(2)),
      image_url: form.image_url.trim() || null,
      available: form.available,
    }

    const { data: upserted, error: dbError } = await supabase
      .from('menu_items')
      .upsert(payload, { onConflict: 'id' })
      .select('id, name, description, image_url, price_eur, price_wallet_units, available, restaurant_id')
      .single()

    if (dbError || !upserted) {
      toast.error(dbError?.message ?? 'Failed to save item.')
      setSaving(false)
      return
    }

    setItems((prev) => {
      const exists = prev.find((i) => i.id === upserted.id)
      return exists
        ? prev.map((i) => (i.id === upserted.id ? (upserted as AdminMenuItem) : i))
        : [...prev, upserted as AdminMenuItem].sort((a, b) => a.name.localeCompare(b.name))
    })

    toast.success(editingId ? 'Item updated.' : 'Item created.')
    setSaving(false)
    closeForm()
  }

  async function handleDelete() {
    if (!editingId) return
    if (!window.confirm('Permanently delete this item? It will no longer appear on the menu.')) return

    const { error } = await supabase
      .from('menu_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', editingId)

    if (error) { toast.error('Could not delete item.'); return }

    setItems((prev) => prev.filter((i) => i.id !== editingId))
    toast.success('Item deleted.')
    closeForm()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader
        backHref="/admin"
        title="Menu Management"
        subtitle={restaurant?.name}
        actions={
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New item</span>
          </button>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <TableSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            title="No menu items yet"
            subtitle="Add your first item to get started."
            action={{ label: '+ New item', onClick: openNew }}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead>
                  <tr className="bg-gray-50">
                    <Th>Name</Th>
                    <Th className="text-right">€ price</Th>
                    <Th className="text-right">
                      {restaurant?.currency_label ?? 'wallet'} price
                    </Th>
                    <Th className="text-center">Available</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                              onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <ImageOff className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-gray-400 truncate max-w-[200px] mt-0.5">{item.description}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-gray-800">€{item.price_eur.toFixed(2)}</span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-gray-800">{item.price_wallet_units.toFixed(2)}</span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleAvailability(item)}
                          disabled={togglingRef.current.has(item.id)}
                          aria-label={item.available ? 'Hide item' : 'Show item'}
                          className={[
                            'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-colors',
                            item.available
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                            togglingRef.current.has(item.id) ? 'opacity-50 cursor-not-allowed' : '',
                          ].join(' ')}
                        >
                          {togglingRef.current.has(item.id) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : item.available ? 'Available' : 'Hidden'}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingId ? 'Edit item' : 'New item'}
        footer={
          <>
            {editingId && (
              <button
                type="button"
                onClick={handleDelete}
                aria-label="Delete item"
                className="p-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={closeForm}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              form="menu-item-form"
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create item'}
            </button>
          </>
        }
      >
        <form
          id="menu-item-form"
          onSubmit={handleSave}
          className="px-5 py-5 space-y-4"
          noValidate
        >
          <Field label="Name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Wiener Schnitzel"
              className={inputCls}
              required
            />
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Short description shown on the menu…"
              rows={2}
              className={inputCls + ' resize-none'}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (€)" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">€</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.price_eur}
                  onChange={(e) => setForm((f) => ({ ...f, price_eur: e.target.value }))}
                  placeholder="0.00"
                  className={inputCls + ' pl-7'}
                  required
                />
              </div>
            </Field>

            <Field label={`Ticket equivalent (${restaurant?.currency_label ?? 'tickets'})`}>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.price_wallet_units}
                onChange={(e) => setForm((f) => ({ ...f, price_wallet_units: e.target.value }))}
                placeholder="0 = auto from € price"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Image URL">
            <input
              type="url"
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              placeholder="https://…"
              className={inputCls}
            />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative flex-shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.available}
                onChange={(e) => setForm((f) => ({ ...f, available: e.target.checked }))}
              />
              <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-orange-500 transition-colors" />
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
            </div>
            <span className="text-sm font-medium text-gray-700">
              {form.available ? 'Visible on menu' : 'Hidden from menu'}
            </span>
          </label>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {formError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}

export default withRole(['admin'], AdminMenuPage)

// ── Local table header helper ─────────────────────────────────────────────────

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  )
}
