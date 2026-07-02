import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Receipt,
  Wallet,
  CreditCard,
  ArrowRight,
  FilePlus2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSettingsStore } from '../store/settings'
import { formatCurrency, formatDateTime } from '../lib/format'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, type PaymentMethod } from '../lib/types'
import { Spinner } from '../components/ui/Spinner'
import { useAuthStore } from '../store/auth'
import { hasPermission } from '../lib/permissions'

interface DashboardData {
  revenueToday: number
  revenueWeek: number
  revenueMonth: number
  transactionCount: number
  byMethod: Record<PaymentMethod, number>
  byService: { name: string; total: number; count: number }[]
  recent: { id: string; receipt_number: string; customer_name: string; grand_total: number; payment_status: string; transaction_date: string }[]
}

export function DashboardPage() {
  const { settings, load: loadSettings } = useSettingsStore()
  const staff = useAuthStore((s) => s.staff)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const result = await fetchDashboard()
      if (!cancelled) {
        setData(result)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const symbol = settings?.currency_symbol || '₦'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Welcome back, {staff?.full_name}. Here's your financial overview.
          </p>
        </div>
        {hasPermission(staff?.role, 'create_transaction') && (
          <Link to="/billing" className="btn-primary">
            <FilePlus2 size={16} />
            New Bill
          </Link>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Revenue Today"
          value={formatCurrency(data?.revenueToday || 0, symbol)}
          icon={CalendarDays}
          color="brand"
        />
        <SummaryCard
          label="This Week"
          value={formatCurrency(data?.revenueWeek || 0, symbol)}
          icon={CalendarRange}
          color="blue"
        />
        <SummaryCard
          label="This Month"
          value={formatCurrency(data?.revenueMonth || 0, symbol)}
          icon={CalendarClock}
          color="amber"
        />
        <SummaryCard
          label="Transactions"
          value={String(data?.transactionCount || 0)}
          icon={Receipt}
          color="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by payment method */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={18} className="text-brand-600" />
            <h2 className="text-base font-semibold text-slate-800">Revenue by Payment Method</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(data?.byMethod || {}).map(([method, amount]) => {
              const total = Object.values(data?.byMethod || {}).reduce((a, b) => a + b, 0)
              const pct = total > 0 ? (amount / total) * 100 : 0
              return (
                <div key={method}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">{PAYMENT_METHOD_LABELS[method as PaymentMethod]}</span>
                    <span className="font-medium text-slate-800">{formatCurrency(amount, symbol)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {Object.values(data?.byMethod || {}).every((v) => v === 0) && (
              <p className="text-sm text-slate-400 text-center py-4">No revenue recorded yet.</p>
            )}
          </div>
        </div>

        {/* Revenue by service */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-brand-600" />
            <h2 className="text-base font-semibold text-slate-800">Revenue by Service</h2>
          </div>
          <div className="space-y-3">
            {(data?.byService || []).slice(0, 6).map((s) => {
              const max = Math.max(...(data?.byService || []).map((x) => x.total), 1)
              const pct = (s.total / max) * 100
              return (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 truncate">{s.name}</span>
                    <span className="font-medium text-slate-800">{formatCurrency(s.total, symbol)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {(!data?.byService || data.byService.length === 0) && (
              <p className="text-sm text-slate-400 text-center py-4">No services billed yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-brand-600" />
            <h2 className="text-base font-semibold text-slate-800">Recent Transactions</h2>
          </div>
          <Link to="/transactions" className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="table-header">Receipt #</th>
                <th className="table-header">Customer</th>
                <th className="table-header">Date</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent || []).map((t) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="table-cell font-mono text-xs text-brand-700">{t.receipt_number}</td>
                  <td className="table-cell font-medium text-slate-800">{t.customer_name}</td>
                  <td className="table-cell text-slate-500">{formatDateTime(t.transaction_date)}</td>
                  <td className="table-cell text-right font-medium">{formatCurrency(t.grand_total, symbol)}</td>
                  <td className="table-cell">
                    <StatusBadge status={t.payment_status} />
                  </td>
                </tr>
              ))}
              {(!data?.recent || data.recent.length === 0) && (
                <tr>
                  <td colSpan={5} className="text-center text-sm text-slate-400 py-8">
                    No transactions yet. Create your first bill to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  icon: typeof TrendingUp
  color: 'brand' | 'blue' | 'amber' | 'slate'
}) {
  const colors = {
    brand: 'bg-brand-50 text-brand-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  }
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    paid: 'bg-brand-100 text-brand-700',
    partial: 'bg-amber-100 text-amber-700',
    unpaid: 'bg-red-100 text-red-700',
  }[status] || 'bg-slate-100 text-slate-700'
  return <span className={`badge ${config}`}>{PAYMENT_STATUS_LABELS[status as keyof typeof PAYMENT_STATUS_LABELS] || status}</span>
}

async function fetchDashboard(): Promise<DashboardData> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  startOfWeek.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [today, week, month, count, methodAgg, serviceAgg, recent] = await Promise.all([
    supabase.from('transactions').select('amount_paid').gte('transaction_date', startOfDay),
    supabase.from('transactions').select('amount_paid').gte('transaction_date', startOfWeek.toISOString()),
    supabase.from('transactions').select('amount_paid').gte('transaction_date', startOfMonth),
    supabase.from('transactions').select('id', { count: 'exact', head: true }),
    supabase.from('transactions').select('payment_method, amount_paid'),
    supabase.from('transaction_items').select('service_name, total_amount'),
    supabase.from('transactions').select('id, receipt_number, customer_name, grand_total, payment_status, transaction_date').order('transaction_date', { ascending: false }).limit(8),
  ])

  const sum = (rows: { amount_paid: number }[] | null) => (rows || []).reduce((a, r) => a + Number(r.amount_paid), 0)

  const byMethod: Record<PaymentMethod, number> = { cash: 0, pos: 0, bank_transfer: 0, mobile_transfer: 0 }
  ;(methodAgg.data || []).forEach((r: { payment_method: PaymentMethod; amount_paid: number }) => {
    byMethod[r.payment_method] = (byMethod[r.payment_method] || 0) + Number(r.amount_paid)
  })

  const serviceMap = new Map<string, { total: number; count: number }>()
  ;(serviceAgg.data || []).forEach((r: { service_name: string; total_amount: number }) => {
    const existing = serviceMap.get(r.service_name) || { total: 0, count: 0 }
    existing.total += Number(r.total_amount)
    existing.count += 1
    serviceMap.set(r.service_name, existing)
  })
  const byService = Array.from(serviceMap.entries())
    .map(([name, v]) => ({ name, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)

  return {
    revenueToday: sum(today.data as { amount_paid: number }[] | null),
    revenueWeek: sum(week.data as { amount_paid: number }[] | null),
    revenueMonth: sum(month.data as { amount_paid: number }[] | null),
    transactionCount: count.count || 0,
    byMethod,
    byService,
    recent: (recent.data as DashboardData['recent']) || [],
  }
}
