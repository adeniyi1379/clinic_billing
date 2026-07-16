import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Pencil, Trash2, Receipt as ReceiptIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Transaction, TransactionItem } from '../lib/types'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../lib/types'
import { useSettingsStore } from '../store/settings'
import { useAuthStore } from '../store/auth'
import { formatCurrency, formatDateTime } from '../lib/format'
import { hasPermission } from '../lib/permissions'
import { logAudit } from '../lib/audit'
import { Receipt } from '../components/Receipt'
import { openReceiptPrintWindow, printNodeAsImage, printNodeDomOnly } from '../lib/receiptImage'
import { Spinner } from '../components/ui/Spinner'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { toast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { PAYMENT_METHOD_LABELS as PM_LABELS } from '../lib/types'
import type { PaymentMethod } from '../lib/types'

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { settings, load: loadSettings } = useSettingsStore()
  const staff = useAuthStore((s) => s.staff)
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [items, setItems] = useState<TransactionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadSettings() }, [loadSettings])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const [{ data: tx, error: txErr }, { data: itemsData, error: itemsErr }] = await Promise.all([
        supabase.from('transactions').select('*').eq('id', id).maybeSingle(),
        supabase.from('transaction_items').select('*').eq('transaction_id', id).order('created_at', { ascending: true }),
      ])
      if (cancelled) return
      if (txErr || itemsErr) {
        toast.error('Failed to load transaction.')
        setLoading(false)
        return
      }
      setTransaction(tx as Transaction | null)
      setItems((itemsData as TransactionItem[]) || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [id])

  // Auto-print on first load if ?print=1
  useEffect(() => {
    if (!loading && transaction && searchParams.get('print') === '1') {
      const t = setTimeout(() => doPrint(), 400)
      return () => clearTimeout(t)
    }
  }, [loading, transaction, searchParams])

  const symbol = settings?.currency_symbol || '₦'

  const doPrint = async () => {
    const node = printRef.current
    if (!node) return
    let printWindow: Window | null = null

    try {
      printWindow = openReceiptPrintWindow()
      await printNodeAsImage(node, printWindow)
    } catch (err) {
      console.error('Receipt image print failed', err)
      try {
        await printNodeDomOnly(node, printWindow ?? undefined)
        toast.error('Receipt image generation failed. Printed the receipt-only fallback instead.')
      } catch (fallbackErr) {
        console.error('Receipt fallback print failed', fallbackErr)
        toast.error('Could not print the receipt.')
      }
    }
  }

  const handlePrint = doPrint

  const handleDelete = async () => {
    if (!transaction) return
    setDeleting(true)
    const { error } = await supabase.from('transactions').delete().eq('id', transaction.id)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete: ' + error.message)
      return
    }
    await logAudit('delete_transaction', 'transaction', transaction.id, {
      receipt_number: transaction.receipt_number,
      customer_name: transaction.customer_name,
      grand_total: transaction.grand_total,
    }, staff?.full_name, staff?.id)
    toast.success('Transaction deleted.')
    navigate('/transactions')
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size={28} /></div>
  }
  if (!transaction) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Transaction not found.</p>
        <Link to="/transactions" className="btn-secondary mt-4">Back to Transactions</Link>
      </div>
    )
  }

  const canEdit = hasPermission(staff?.role, 'edit_transaction')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="no-print flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/transactions" className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{transaction.receipt_number}</h1>
            <p className="text-sm text-slate-500">{formatDateTime(transaction.transaction_date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={handlePrint}>
            <Printer size={16} /> Print Receipt
          </button>
          {canEdit && (
            <>
              <button className="btn-secondary" onClick={() => setEditOpen(true)}>
                <Pencil size={16} /> Edit
              </button>
              <button className="btn-danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={16} /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
        {/* Summary card */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <ReceiptIcon size={18} className="text-brand-600" />
            Transaction Summary
          </h2>
          <dl className="space-y-2.5 text-sm">
            <Row label="Customer" value={transaction.customer_name} />
            {transaction.card_number && <Row label="Card Number" value={transaction.card_number} />}
            {transaction.phone_number && <Row label="Phone" value={transaction.phone_number} />}
            <Row label="Payment Method" value={PAYMENT_METHOD_LABELS[transaction.payment_method]} />
            <Row label="Payment Status" value={
              <span className={`badge ${
                transaction.payment_status === 'paid' ? 'bg-brand-100 text-brand-700' :
                transaction.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>{PAYMENT_STATUS_LABELS[transaction.payment_status]}</span>
            } />
            <Row label="Served By" value={transaction.staff_name} />
            {transaction.notes && <Row label="Notes" value={transaction.notes} />}
          </dl>
        </div>

        {/* Amounts */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Amounts</h2>
          <div className="space-y-3">
            <AmountRow label="Subtotal" value={formatCurrency(transaction.subtotal, symbol)} />
            <AmountRow label="Grand Total" value={formatCurrency(transaction.grand_total, symbol)} bold />
            <AmountRow label="Amount Paid" value={formatCurrency(transaction.amount_paid, symbol)} />
            <AmountRow
              label="Outstanding Balance"
              value={formatCurrency(transaction.outstanding_balance, symbol)}
              highlight={transaction.outstanding_balance > 0}
            />
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="card no-print">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">Services Billed</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="table-header">Service</th>
                <th className="table-header">Description</th>
                <th className="table-header text-right">Qty</th>
                <th className="table-header text-right">Unit Price</th>
                <th className="table-header text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-slate-100">
                  <td className="table-cell font-medium text-slate-800">{it.service_name}</td>
                  <td className="table-cell text-slate-500">{it.description || '—'}</td>
                  <td className="table-cell text-right">{it.quantity}</td>
                  <td className="table-cell text-right">{formatCurrency(it.unit_price, symbol)}</td>
                  <td className="table-cell text-right font-medium">{formatCurrency(it.total_amount, symbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable POS receipt */}
      <div className="no-print bg-slate-200 p-4 rounded-lg flex justify-center">
        <div className="shadow-md">
          <Receipt transaction={transaction} items={items} settings={settings} />
        </div>
      </div>

      {/* Off-screen render target for image-based printing */}
      <div
        ref={printRef}
        aria-hidden
        style={{ position: 'absolute', left: '-9999px', top: 0, background: '#fff' }}
      >
        <Receipt transaction={transaction} items={items} settings={settings} />
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Transaction"
        message={`Delete receipt ${transaction.receipt_number}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />

      {editOpen && (
        <EditTransactionModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          transaction={transaction}
          onSaved={() => { setEditOpen(false); window.location.reload() }}
          staffName={staff?.full_name || ''}
          staffId={staff?.id}
        />
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800 font-medium text-right">{value}</dd>
    </div>
  )
}

function AmountRow({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`${bold ? 'text-lg font-bold text-slate-800' : 'font-medium text-slate-700'} ${highlight ? 'text-amber-600' : ''}`}>{value}</span>
    </div>
  )
}

interface EditModalProps {
  open: boolean
  onClose: () => void
  transaction: Transaction
  onSaved: () => void
  staffName: string
  staffId: string | undefined
}

function EditTransactionModal({ open, onClose, transaction, onSaved, staffName, staffId }: EditModalProps) {
  const [amountPaid, setAmountPaid] = useState(String(transaction.amount_paid))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(transaction.payment_method)
  const [notes, setNotes] = useState(transaction.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paidNum = parseFloat(amountPaid) || 0
  const outstanding = Math.max(0, transaction.grand_total - paidNum)
  const status = paidNum === 0 ? 'unpaid' : outstanding > 0 ? 'partial' : 'paid'

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (paidNum < 0) { setError('Amount paid cannot be negative.'); return }
    if (paidNum > transaction.grand_total) { setError('Amount paid cannot exceed grand total.'); return }
    setSaving(true)
    const { error } = await supabase.from('transactions').update({
      amount_paid: paidNum,
      outstanding_balance: outstanding,
      payment_status: status,
      payment_method: paymentMethod,
      notes: notes.trim(),
    }).eq('id', transaction.id)
    if (error) { setError(error.message); setSaving(false); return }
    await logAudit('update_transaction', 'transaction', transaction.id, {
      receipt_number: transaction.receipt_number,
      amount_paid: paidNum,
      payment_method: paymentMethod,
    }, staffName, staffId)
    setSaving(false)
    toast.success('Transaction updated.')
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Transaction" description={`Receipt ${transaction.receipt_number}`}>
      <form onSubmit={handleSave} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Customer</span><span className="font-medium">{transaction.customer_name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Grand Total</span><span className="font-medium">{formatCurrency(transaction.grand_total)}</span></div>
        </div>
        <div>
          <label className="label" htmlFor="edit-paid">Amount Paid</label>
          <input id="edit-paid" type="number" min="0" step="0.01" className="input" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="edit-method">Payment Method</label>
          <select id="edit-method" className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            {Object.entries(PM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-200">
          <span className="text-sm text-slate-600">Outstanding</span>
          <span className={`font-bold ${outstanding > 0 ? 'text-amber-600' : 'text-brand-600'}`}>{formatCurrency(outstanding)}</span>
        </div>
        <div>
          <label className="label" htmlFor="edit-notes">Notes</label>
          <textarea id="edit-notes" className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  )
}
