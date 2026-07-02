import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, ListChecks, Eye, FilePlus2, Filter, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Transaction, PaymentMethod, PaymentStatus } from '../lib/types'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../lib/types'
import { useSettingsStore } from '../store/settings'
import { useAuthStore } from '../store/auth'
import { formatCurrency, formatDateTime } from '../lib/format'
import { hasPermission } from '../lib/permissions'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'

const PAGE_SIZE = 20

export function TransactionsPage() {
  const { settings, load: loadSettings } = useSettingsStore()
  const staff = useAuthStore((s) => s.staff)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('transactions').select('*', { count: 'exact' })

    if (search.trim()) {
      query = query.or(`customer_name.ilike.%${search.trim()}%,receipt_number.ilike.%${search.trim()}%,card_number.ilike.%${search.trim()}%,phone_number.ilike.%${search.trim()}%`)
    }
    if (methodFilter !== 'all') query = query.eq('payment_method', methodFilter)
    if (statusFilter !== 'all') query = query.eq('payment_status', statusFilter)
    if (dateFrom) query = query.gte('transaction_date', new Date(dateFrom).toISOString())
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      query = query.lte('transaction_date', end.toISOString())
    }

    query = query.order('transaction_date', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    const { data, error, count } = await query
    if (error) {
      console.error(error)
    }
    setTransactions((data as Transaction[]) || [])
    setTotal(count || 0)
    setLoading(false)
  }, [search, methodFilter, statusFilter, dateFrom, dateTo, page])

  useEffect(() => { loadSettings() }, [loadSettings])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search, methodFilter, statusFilter, dateFrom, dateTo])

  const symbol = settings?.currency_symbol || '₦'
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasFilters = methodFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo

  const clearFilters = () => {
    setMethodFilter('all')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
    setSearch('')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Transaction Register</h1>
          <p className="text-sm text-slate-500 mt-0.5">Search and filter all billing transactions.</p>
        </div>
        {hasPermission(staff?.role, 'create_transaction') && (
          <Link to="/billing" className="btn-primary">
            <FilePlus2 size={16} /> New Bill
          </Link>
        )}
      </div>

      <div className="card">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className="input pl-9"
                placeholder="Search by receipt #, customer, card, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              className={`btn-secondary ${showFilters || hasFilters ? 'bg-brand-50 border-brand-300 text-brand-700' : ''}`}
              onClick={() => setShowFilters((s) => !s)}
            >
              <Filter size={16} /> Filters
              {hasFilters && <span className="w-2 h-2 rounded-full bg-brand-500" />}
            </button>
            {(hasFilters || search) && (
              <button className="btn-ghost" onClick={clearFilters}>
                <X size={16} /> Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-200 animate-fade-in">
              <div>
                <label className="label">Payment Method</label>
                <select className="input" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as PaymentMethod | 'all')}>
                  <option value="all">All methods</option>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Payment Status</label>
                <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'all')}>
                  <option value="all">All statuses</option>
                  {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">From Date</label>
                <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="label">To Date</label>
                <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size={24} /></div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No transactions found"
            description={hasFilters || search ? "Try adjusting your search or filters." : "Create your first bill to see it here."}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="table-header">Receipt #</th>
                    <th className="table-header">Customer</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Method</th>
                    <th className="table-header text-right">Total</th>
                    <th className="table-header text-right">Paid</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Staff</th>
                    <th className="table-header text-right">View</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="table-cell font-mono text-xs text-brand-700">{t.receipt_number}</td>
                      <td className="table-cell font-medium text-slate-800">{t.customer_name}</td>
                      <td className="table-cell text-slate-500 whitespace-nowrap">{formatDateTime(t.transaction_date)}</td>
                      <td className="table-cell text-slate-600">{PAYMENT_METHOD_LABELS[t.payment_method]}</td>
                      <td className="table-cell text-right font-medium">{formatCurrency(t.grand_total, symbol)}</td>
                      <td className="table-cell text-right text-slate-600">{formatCurrency(t.amount_paid, symbol)}</td>
                      <td className="table-cell">
                        <span className={`badge ${
                          t.payment_status === 'paid' ? 'bg-brand-100 text-brand-700' :
                          t.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>{PAYMENT_STATUS_LABELS[t.payment_status]}</span>
                      </td>
                      <td className="table-cell text-slate-600">{t.staff_name}</td>
                      <td className="table-cell text-right">
                        <Link to={`/transactions/${t.id}`} className="inline-flex p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                          <Eye size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t border-slate-200 text-sm">
              <span className="text-slate-500">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <span className="px-3 py-2 text-slate-600">
                  Page {page + 1} of {totalPages || 1}
                </span>
                <button className="btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
