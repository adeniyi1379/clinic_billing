export type UserRole = 'administrator' | 'cashier' | 'receptionist' | 'accountant'

export type PaymentMethod = 'cash' | 'pos' | 'bank_transfer' | 'mobile_transfer'

export type PaymentStatus = 'paid' | 'partial' | 'unpaid'

export interface Staff {
  id: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  email?: string
}

export interface HospitalSettings {
  id: number
  name: string
  address: string
  phone: string
  email: string
  website: string
  logo_url: string
  currency_symbol: string
  receipt_prefix: string
  footer_message: string
  updated_at: string
}

export interface Service {
  id: string
  name: string
  description: string
  default_price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  receipt_number: string
  customer_name: string
  card_number: string
  phone_number: string
  subtotal: number
  grand_total: number
  amount_paid: number
  outstanding_balance: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  staff_id: string
  staff_name: string
  transaction_date: string
  notes: string
  created_at: string
  transaction_items?: TransactionItem[]
}

export interface TransactionItem {
  id: string
  transaction_id: string
  service_id: string | null
  service_name: string
  description: string
  quantity: number
  unit_price: number
  total_amount: number
  created_at: string
}

export interface AuditLogEntry {
  id: string
  staff_id: string | null
  staff_name: string
  action: string
  entity_type: string
  entity_id: string
  details: Record<string, unknown>
  created_at: string
}

export interface BillItemDraft {
  id: string
  service_id: string | null
  service_name: string
  description: string
  quantity: number
  unit_price: number
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  pos: 'POS',
  bank_transfer: 'Bank Transfer',
  mobile_transfer: 'Mobile Transfer',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: 'Administrator',
  cashier: 'Cashier',
  receptionist: 'Receptionist',
  accountant: 'Accountant',
}
