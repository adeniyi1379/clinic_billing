import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, User, Stethoscope, Save, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Service, PaymentMethod, BillItemDraft } from '../lib/types'
import { PAYMENT_METHOD_LABELS } from '../lib/types'
import { useSettingsStore } from '../store/settings'
import { useAuthStore } from '../store/auth'
import { formatCurrency, generateId } from '../lib/format'
import { logAudit } from '../lib/audit'
import { Spinner } from '../components/ui/Spinner'
import { toast } from '../components/ui/Toast'

export function BillingPage() {
  const navigate = useNavigate()
  const { settings, load: loadSettings } = useSettingsStore()
  const staff = useAuthStore((s) => s.staff)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [customerName, setCustomerName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [items, setItems] = useState<BillItemDraft[]>([])
  const [amountPaid, setAmountPaid] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadSettings() }, [loadSettings])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })
      if (error) toast.error('Failed to load services: ' + error.message)
      setServices((data as Service[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  const symbol = settings?.currency_symbol || '₦'

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0),
    [items]
  )
  const grandTotal = subtotal
  const paidNum = parseFloat(amountPaid) || 0
  const outstanding = Math.max(0, grandTotal - paidNum)
  const paymentStatus = paidNum === 0 ? 'unpaid' : outstanding > 0 ? 'partial' : 'paid'

  const addServiceItem = (service: Service) => {
    setItems((prev) => {
      const existing = prev.find((it) => it.service_id === service.id)
      if (existing) {
        return prev.map((it) =>
          it.service_id === service.id
            ? { ...it, quantity: it.quantity + 1 }
            : it
        )
      }
      return [
        ...prev,
        {
          id: generateId(),
          service_id: service.id,
          service_name: service.name,
          description: service.description,
          quantity: 1,
          unit_price: 0,
        },
      ]
    })
  }

  const addCustomItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: generateId(),
        service_id: null,
        service_name: '',
        description: '',
        quantity: 1,
        unit_price: 0,
      },
    ])
  }

  const updateItem = (id: string, patch: Partial<BillItemDraft>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const setFullPayment = () => {
    setAmountPaid(String(grandTotal.toFixed(2)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!customerName.trim()) { setError('Customer name is required.'); return }
    if (items.length === 0) { setError('Add at least one service to the bill.'); return }
    for (const it of items) {
      if (!it.service_name.trim()) { setError('Every line item needs a service name.'); return }
      if (it.quantity < 1) { setError('Quantities must be at least 1.'); return }
      if (it.unit_price < 0) { setError('Unit prices cannot be negative.'); return }
    }
    if (paidNum < 0) { setError('Amount paid cannot be negative.'); return }
    if (paidNum > grandTotal) { setError('Amount paid cannot exceed the grand total.'); return }

    setSaving(true)
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .insert({
        customer_name: customerName.trim(),
        card_number: cardNumber.trim(),
        phone_number: phoneNumber.trim(),
        subtotal,
        grand_total: grandTotal,
        amount_paid: paidNum,
        outstanding_balance: outstanding,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        staff_id: staff?.id,
        staff_name: staff?.full_name || '',
        notes: notes.trim(),
      })
      .select()
      .maybeSingle()

    if (txError) {
      setError('Failed to create transaction: ' + txError.message)
      setSaving(false)
      return
    }
    if (!txData) {
      setError('Failed to create transaction: no data returned.')
      setSaving(false)
      return
    }

    const tx = txData as { id: string; receipt_number: string }
    const itemRows = items.map((it) => ({
      transaction_id: tx.id,
      service_id: it.service_id,
      service_name: it.service_name.trim(),
      description: it.description.trim(),
      quantity: it.quantity,
      unit_price: it.unit_price,
      total_amount: it.quantity * it.unit_price,
    }))
    const { error: itemsError } = await supabase.from('transaction_items').insert(itemRows)
    if (itemsError) {
      setError('Transaction created, but failed to save line items: ' + itemsError.message)
      setSaving(false)
      return
    }

    await logAudit('create_transaction', 'transaction', tx.id, {
      receipt_number: tx.receipt_number,
      customer_name: customerName,
      grand_total: grandTotal,
      amount_paid: paidNum,
    }, staff?.full_name, staff?.id)

    toast.success('Bill created successfully.')
    setSaving(false)
    navigate(`/transactions/${tx.id}?print=1`)
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size={28} /></div>
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Create New Bill</h1>
        <p className="text-sm text-slate-500 mt-0.5">Enter customer details, add services, and record payment.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: customer + services */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer info */}
          <div className="card p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <User size={18} className="text-brand-600" />
              Customer Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <label className="label" htmlFor="cust-name">Customer Name *</label>
                <input id="cust-name" className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full name" autoFocus />
              </div>
              <div>
                <label className="label" htmlFor="cust-card">Card Number</label>
                <input id="cust-card" className="input" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="Hospital card #" />
              </div>
              <div>
                <label className="label" htmlFor="cust-phone">Phone Number</label>
                <input id="cust-phone" className="input" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="080..." />
              </div>
            </div>
          </div>

          {/* Service picker */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Stethoscope size={18} className="text-brand-600" />
                Add Services
              </h2>
              <button type="button" className="btn-ghost text-sm" onClick={addCustomItem}>
                <Plus size={14} /> Custom item
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => addServiceItem(s)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                >
                  <Plus size={14} />
                  {s.name}
                </button>
              ))}
            </div>

            {/* Line items */}
            {items.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                No services added yet. Click a service above or add a custom item.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={it.id} className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="col-span-12 sm:col-span-4">
                      <label className="text-xs text-slate-500 mb-1 block">Service Name</label>
                      <input
                        className="input"
                        value={it.service_name}
                        onChange={(e) => updateItem(it.id, { service_name: e.target.value })}
                        placeholder="Service name"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-3">
                      <label className="text-xs text-slate-500 mb-1 block">Description</label>
                      <input
                        className="input"
                        value={it.description}
                        onChange={(e) => updateItem(it.id, { description: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <label className="text-xs text-slate-500 mb-1 block">Qty</label>
                      <input
                        type="number"
                        min="1"
                        className="input"
                        value={it.quantity}
                        onChange={(e) => updateItem(it.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <label className="text-xs text-slate-500 mb-1 block">Unit Price ({symbol})</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input"
                        value={it.unit_price || ''}
                        onChange={(e) => updateItem(it.id, { unit_price: Math.max(0, parseFloat(e.target.value) || 0) })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex flex-col items-end">
                      <label className="text-xs text-slate-500 mb-1 block w-full text-right">Total</label>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium text-slate-700 min-w-[60px] text-right">
                          {formatCurrency(it.quantity * it.unit_price, symbol)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(it.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: payment summary */}
        <div className="space-y-6">
          <div className="card p-5 sticky top-20">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Payment Summary</h2>

            <div className="space-y-2 mb-4 pb-4 border-b border-slate-200">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal, symbol)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Grand Total</span>
                <span className="text-lg font-bold text-slate-800">{formatCurrency(grandTotal, symbol)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0" htmlFor="amount-paid">Amount Paid</label>
                  <button type="button" onClick={setFullPayment} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                    Full payment
                  </button>
                </div>
                <input
                  id="amount-paid"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="label" htmlFor="payment-method">Payment Method</label>
                <select
                  id="payment-method"
                  className="input"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-sm text-slate-600">Outstanding Balance</span>
                <span className={`font-bold ${outstanding > 0 ? 'text-amber-600' : 'text-brand-600'}`}>
                  {formatCurrency(outstanding, symbol)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Status</span>
                <span className={`badge ${
                  paymentStatus === 'paid' ? 'bg-brand-100 text-brand-700' :
                  paymentStatus === 'partial' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                </span>
              </div>

              <div>
                <label className="label" htmlFor="notes">Notes (optional)</label>
                <textarea id="notes" className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" />
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full mt-4" disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving...' : 'Save & Generate Receipt'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
