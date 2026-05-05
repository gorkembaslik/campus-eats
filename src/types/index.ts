export type Role = 'customer' | 'cashier' | 'admin'
export type PricingModel = 'monetary' | 'ticket_count'
export type PaymentMethod = 'wallet' | 'stripe' | 'mixed'
export type OrderStatus = 'awaiting_payment' | 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'

// Shared order shapes (promoted from OrderStatusClient for reuse in cashier dashboard)
export interface OrderItem {
  id: string
  quantity: number
  unit_price_eur: number
  unit_price_wallet_units: number
  menu_items: { name: string } | null
}

export interface OrderPayment {
  wallet_units_provisioned: number | null
  stripe_amount_eur: number | null
}

export interface CashierPayment {
  stripe_payment_intent_id: string | null
  wallet_units_provisioned: number | null
  stripe_amount_eur: number | null
  status: string
}

export interface CashierOrder {
  id: string
  status: OrderStatus
  payment_method: PaymentMethod
  created_at: string
  restaurant_id: string
  user_id: string
  users: { full_name: string | null } | null
  order_items: OrderItem[]
  payments: CashierPayment[]
}

export interface Restaurant {
  id: string
  name: string
  slug: string
  pricing_model: PricingModel
  currency_label: string
  ticket_eur_value: number
  cover_image_url?: string | null
}

export interface MenuItem {
  id: string
  name: string
  description: string | null
  image_url: string | null
  price_eur: number
  price_wallet_units: number
  category?: string | null
}

export interface UserProfile {
  id: string
  full_name: string | null
  email: string | null
  role: Role
  created_at: string
}

export interface WalletAccount {
  id: string
  user_id: string
  restaurant_id: string
  balance: number
  created_at: string
  restaurants: {
    name: string
    slug: string | null
    currency_label: string | null
    ticket_eur_value: number | null
  } | null
}

export type TransactionType = 'credit' | 'debit' | 'provision' | 'release'

export interface WalletTransaction {
  id: string
  wallet_id: string
  cashier_id: string | null
  type: TransactionType
  amount: number
  ticket_code: string | null
  note: string | null
  created_at: string
}

export interface WalletWithRestaurant {
  id: string
  user_id: string
  restaurant_id: string
  balance: number
  restaurants: {
    name: string
    slug: string | null
    currency_label: string | null
    ticket_eur_value: number | null
  } | null
}

export interface CustomerOrderRow {
  id: string
  status: OrderStatus
  payment_method: PaymentMethod
  created_at: string
  restaurants: { name: string; slug: string | null; currency_label: string | null } | null
  order_items: { quantity: number; unit_price_eur: number }[]
}

export interface AdminUserRow {
  id: string
  full_name: string | null
  email: string | null
  role: Role
  created_at: string
}

export interface AuditRow {
  id: string
  amount: number
  ticket_code: string | null
  note: string | null
  created_at: string
  cashier: { id: string; full_name: string | null } | null
  wallet: {
    user: { id: string; full_name: string | null; email: string | null } | null
    restaurant: { id: string; name: string; currency_label: string | null } | null
  } | null
}

export type DenominationMap = Record<string, number>
