import { useEffect, useState } from 'react'
import { Save, Building2, Settings as SettingsIcon } from 'lucide-react'
import { useSettingsStore } from '../store/settings'
import { useAuthStore } from '../store/auth'
import { logAudit } from '../lib/audit'
import { Spinner } from '../components/ui/Spinner'
import { toast } from '../components/ui/Toast'

export function SettingsPage() {
  const { settings, load, update, loading } = useSettingsStore()
  const staff = useAuthStore((s) => s.staff)
  const [form, setForm] = useState({
    name: '', address: '', phone: '', email: '', website: '', logo_url: '',
    currency_symbol: '₦', receipt_prefix: 'RCP', footer_message: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (settings) {
      setForm({
        name: settings.name, address: settings.address, phone: settings.phone,
        email: settings.email, website: settings.website, logo_url: settings.logo_url,
        currency_symbol: settings.currency_symbol, receipt_prefix: settings.receipt_prefix,
        footer_message: settings.footer_message,
      })
    }
  }, [settings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await update(form)
    setSaving(false)
    if (error) {
      toast.error('Failed to save: ' + error)
      return
    }
    await logAudit('update_settings', 'hospital_settings', '1', form, staff?.full_name, staff?.id)
    toast.success('Settings saved.')
  }

  if (loading || !settings) {
    return <div className="flex justify-center py-20"><Spinner size={28} /></div>
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Hospital Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure hospital identity printed on receipts.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 max-w-3xl">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-200">
          <Building2 size={20} className="text-brand-600" />
          <h2 className="text-base font-semibold text-slate-800">Hospital Information</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="set-name">Hospital Name</label>
            <input id="set-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="set-addr">Address</label>
            <input id="set-addr" className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="set-phone">Phone</label>
            <input id="set-phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="set-email">Email</label>
            <input id="set-email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="set-web">Website</label>
            <input id="set-web" className="input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="set-logo">Logo URL (optional)</label>
            <input id="set-logo" className="input" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-8 mb-5 pb-4 border-b border-slate-200">
          <SettingsIcon size={20} className="text-brand-600" />
          <h2 className="text-base font-semibold text-slate-800">Receipt Configuration</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="set-currency">Currency Symbol</label>
            <input id="set-currency" className="input" value={form.currency_symbol} onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })} maxLength={3} />
          </div>
          <div>
            <label className="label" htmlFor="set-prefix">Receipt Prefix</label>
            <input id="set-prefix" className="input" value={form.receipt_prefix} onChange={(e) => setForm({ ...form, receipt_prefix: e.target.value.toUpperCase() })} maxLength={6} />
          </div>
          <div className="sm:col-span-3">
            <label className="label" htmlFor="set-footer">Footer Message</label>
            <textarea id="set-footer" className="input min-h-[60px]" value={form.footer_message} onChange={(e) => setForm({ ...form, footer_message: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
