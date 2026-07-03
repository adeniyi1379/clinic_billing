import { useEffect, useState, useCallback,useMemo  } from 'react'
import { BarChart3, FileDown, FileSpreadsheet, TrendingUp, Wallet, Users, Receipt } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSettingsStore } from '../store/settings'
import { useAuthStore } from '../store/auth'
import { formatCurrency, formatDate } from '../lib/format'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '../lib/types'
import { hasPermission } from '../lib/permissions'
import { exportToPDF, exportToExcel, buildTransactionRows } from '../lib/export'
import { Spinner } from '../components/ui/Spinner'
import { toast } from '../components/ui/Toast'

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface ReportData {
  totalRevenue: number
  transactionCount: number
  byMethod: { method: PaymentMethod; total: number; count: number }[]
  byService: { name: string; total: number; count: number }[]
  byStaff: { name: string; total: number; count: number }[]
  transactions: { receipt_number: string; customer_name: string; transaction_date: string; payment_method: PaymentMethod; grand_total: number; amount_paid: number; outstanding_balance: number; payment_status: string; staff_name: string }[]
}

export function ReportsPage() {
  const { settings, load: loadSettings } = useSettingsStore()
  const staff = useAuthStore((s) => s.staff)
  const [period, setPeriod] = useState<Period>('daily')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadSettings() }, [loadSettings])

  // const { from, to, label } = computeRange(period, customFrom, customTo)
  const { from, to, label } = useMemo(
  () => computeRange(period, customFrom, customTo),
  [period, customFrom, customTo]
)


  const load = useCallback(async () => {
    setLoading(true)
    const [txRes, itemsRes] = await Promise.all([
      supabase.from('transactions').select('*').gte('transaction_date', from.toISOString()).lte('transaction_date', to.toISOString()).order('transaction_date', { ascending: false }),
      supabase.from('transaction_items').select('service_name, total_amount, transaction_id, transactions!inner(transaction_date)').gte('transactions.transaction_date', from.toISOString()).lte('transactions.transaction_date', to.toISOString()),
    ])

    const txns = (txRes.data || []) as ReportData['transactions']
    const items = (itemsRes.data || []) as { service_name: string; total_amount: number }[]

    const totalRevenue = txns.reduce((a, t) => a + Number(t.amount_paid), 0)

    const methodMap = new Map<PaymentMethod, { total: number; count: number }>()
    txns.forEach((t) => {
      const e = methodMap.get(t.payment_method) || { total: 0, count: 0 }
      e.total += Number(t.amount_paid)
      e.count += 1
      methodMap.set(t.payment_method, e)
    })
    const byMethod = Array.from(methodMap.entries()).map(([method, v]) => ({ method, ...v })).sort((a, b) => b.total - a.total)

    const serviceMap = new Map<string, { total: number; count: number }>()
    items.forEach((it) => {
      const e = serviceMap.get(it.service_name) || { total: 0, count: 0 }
      e.total += Number(it.total_amount)
      e.count += 1
      serviceMap.set(it.service_name, e)
    })
    const byService = Array.from(serviceMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total)

    const staffMap = new Map<string, { total: number; count: number }>()
    txns.forEach((t) => {
      const e = staffMap.get(t.staff_name) || { total: 0, count: 0 }
      e.total += Number(t.amount_paid)
      e.count += 1
      staffMap.set(t.staff_name, e)
    })
    const byStaff = Array.from(staffMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total)

    setData({ totalRevenue, transactionCount: txns.length, byMethod, byService, byStaff, transactions: txns })
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const symbol = settings?.currency_symbol || '₦'
  const canExport = hasPermission(staff?.role, 'export_reports')

  const handlePDF = () => {
    if (!data) return
    const rows = buildTransactionRows(data.transactions, symbol)
    exportToPDF(
      'Revenue Report',
      label,
      ['Receipt #', 'Customer', 'Date', 'Method', 'Grand Total', 'Amount Paid', 'Outstanding', 'Status', 'Staff'],
      rows,
      settings,
      [
        { label: 'Total Revenue', value: formatCurrency(data.totalRevenue, symbol) },
        { label: 'Transactions', value: String(data.transactionCount) },
        { label: 'Period', value: label },
      ],
    )
    toast.success('PDF exported.')
  }

  const handleExcel = () => {
    if (!data) return
    const txRows = buildTransactionRows(data.transactions, symbol)
    exportToExcel('Revenue Report', [
      {
        name: 'Transactions',
        columns: ['Receipt #', 'Customer', 'Date', 'Method', 'Grand Total', 'Amount Paid', 'Outstanding', 'Status', 'Staff'],
        rows: txRows,
      },
      {
        name: 'By Payment Method',
        columns: ['Method', 'Total Revenue', 'Count'],
        rows: data.byMethod.map((m) => ({ Method: PAYMENT_METHOD_LABELS[m.method], 'Total Revenue': formatCurrency(m.total, symbol), Count: m.count })),
      },
      {
        name: 'By Service',
        columns: ['Service', 'Total Revenue', 'Count'],
        rows: data.byService.map((s) => ({ Service: s.name, 'Total Revenue': formatCurrency(s.total, symbol), Count: s.count })),
      },
      {
        name: 'By Staff',
        columns: ['Staff', 'Total Revenue', 'Count'],
        rows: data.byStaff.map((s) => ({ Staff: s.name, 'Total Revenue': formatCurrency(s.total, symbol), Count: s.count })),
      },
    ])
    toast.success('Excel exported.')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Financial Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Revenue breakdowns and transaction analytics.</p>
        </div>
        {canExport && data && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={handlePDF}>
              <FileDown size={16} /> Export PDF
            </button>
            <button className="btn-secondary" onClick={handleExcel}>
              <FileSpreadsheet size={16} /> Export Excel
            </button>
          </div>
        )}
      </div>

      {/* Period selector */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Period</label>
            <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
              {(['daily', 'weekly', 'monthly', 'yearly'] as Period[]).map((p) => (
                <button
                  key={p}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    period === p ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-end gap-3">
            <div>
              <label className="label">From</label>
              <input type="date" className="input" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setPeriod('daily') }} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setPeriod('daily') }} />
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-3">
          Showing data for: <span className="font-medium text-slate-700">{label}</span>
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size={24} /></div>
      ) : !data || data.transactionCount === 0 ? (
        <div className="card p-12 text-center">
          <BarChart3 size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No transactions in this period.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-500">Total Revenue</span>
                <TrendingUp size={18} className="text-brand-600" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(data.totalRevenue, symbol)}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-500">Transactions</span>
                <Receipt size={18} className="text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{data.transactionCount}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-500">Avg per Transaction</span>
                <Wallet size={18} className="text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-slate-800">
                {formatCurrency(data.transactionCount > 0 ? data.totalRevenue / data.transactionCount : 0, symbol)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By payment method */}
            <div className="card p-5">
              <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Wallet size={18} className="text-brand-600" /> Revenue by Payment Method
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="table-header">Method</th>
                      <th className="table-header text-right">Count</th>
                      <th className="table-header text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byMethod.map((m) => (
                      <tr key={m.method} className="border-b border-slate-100">
                        <td className="table-cell font-medium">{PAYMENT_METHOD_LABELS[m.method]}</td>
                        <td className="table-cell text-right">{m.count}</td>
                        <td className="table-cell text-right font-medium">{formatCurrency(m.total, symbol)}</td>
                      </tr>
                    ))}
                    {data.byMethod.length === 0 && (
                      <tr><td colSpan={3} className="text-center text-sm text-slate-400 py-4">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* By service */}
            <div className="card p-5">
              <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-brand-600" /> Revenue by Service
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="table-header">Service</th>
                      <th className="table-header text-right">Count</th>
                      <th className="table-header text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byService.map((s) => (
                      <tr key={s.name} className="border-b border-slate-100">
                        <td className="table-cell font-medium">{s.name}</td>
                        <td className="table-cell text-right">{s.count}</td>
                        <td className="table-cell text-right font-medium">{formatCurrency(s.total, symbol)}</td>
                      </tr>
                    ))}
                    {data.byService.length === 0 && (
                      <tr><td colSpan={3} className="text-center text-sm text-slate-400 py-4">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* By staff */}
            <div className="card p-5 lg:col-span-2">
              <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Users size={18} className="text-brand-600" /> Revenue by Staff
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="table-header">Staff Member</th>
                      <th className="table-header text-right">Transactions</th>
                      <th className="table-header text-right">Revenue Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byStaff.map((s) => (
                      <tr key={s.name} className="border-b border-slate-100">
                        <td className="table-cell font-medium">{s.name}</td>
                        <td className="table-cell text-right">{s.count}</td>
                        <td className="table-cell text-right font-medium">{formatCurrency(s.total, symbol)}</td>
                      </tr>
                    ))}
                    {data.byStaff.length === 0 && (
                      <tr><td colSpan={3} className="text-center text-sm text-slate-400 py-4">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function computeRange(period: Period, customFrom: string, customTo: string): { from: Date; to: Date; label: string } {
  if (customFrom && customTo) {
    return {
      from: new Date(customFrom),
      to: new Date(customTo + 'T23:59:59'),
      label: `${formatDate(customFrom)} to ${formatDate(customTo)}`,
    }
  }
  const now = new Date()
  switch (period) {
    case 'daily': {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      return { from, to, label: `Today (${formatDate(now)})` }
    }
    case 'weekly': {
      const from = new Date(now)
      from.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      from.setHours(0, 0, 0, 0)
      const to = new Date(from)
      to.setDate(from.getDate() + 6)
      to.setHours(23, 59, 59)
      return { from, to, label: `Week of ${formatDate(from)}` }
    }
    case 'monthly': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      return { from, to, label: from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
    }
    case 'yearly': {
      const from = new Date(now.getFullYear(), 0, 1)
      const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
      return { from, to, label: String(now.getFullYear()) }
    }
  }
}
