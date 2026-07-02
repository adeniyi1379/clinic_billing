import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Stethoscope, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Service } from '../lib/types'
import { useSettingsStore } from '../store/settings'
import { useAuthStore } from '../store/auth'
import { formatCurrency } from '../lib/format'
import { logAudit } from '../lib/audit'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { toast } from '../components/ui/Toast'

export function ServicesPage() {
  const { settings, load: loadSettings } = useSettingsStore()
  const staff = useAuthStore((s) => s.staff)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('name', { ascending: true })
    if (error) {
      toast.error('Failed to load services: ' + error.message)
    }
    setServices((data as Service[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])
  useEffect(() => { load() }, [load])

  const symbol = settings?.currency_symbol || '₦'

  const filtered = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (s: Service) => {
    setEditing(s)
    setModalOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('services').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete service: ' + error.message)
      return
    }
    await logAudit('delete_service', 'service', deleteTarget.id, { name: deleteTarget.name }, staff?.full_name, staff?.id)
    toast.success('Service deleted.')
    setDeleteTarget(null)
    load()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Service Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Add, edit, and manage billable hospital services.</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} />
          Add Service
        </button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Search services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No services found"
            description={search ? "Try a different search term." : "Add your first billable service to get started."}
            action={!search && <button className="btn-primary" onClick={openCreate}><Plus size={16} />Add Service</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="table-header">Service Name</th>
                  <th className="table-header">Description</th>
                  <th className="table-header text-right">Default Price</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="table-cell font-medium text-slate-800">{s.name}</td>
                    <td className="table-cell text-slate-500 max-w-xs truncate">{s.description || '—'}</td>
                    <td className="table-cell text-right font-medium">{formatCurrency(s.default_price, symbol)}</td>
                    <td className="table-cell">
                      {s.is_active ? (
                        <span className="badge bg-brand-100 text-brand-700">Active</span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-600">Inactive</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Edit">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => setDeleteTarget(s)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ServiceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        service={editing}
        symbol={symbol}
        onSaved={() => { setModalOpen(false); load() }}
        staffName={staff?.full_name || ''}
        staffId={staff?.id}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Service"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  )
}

interface ServiceModalProps {
  open: boolean
  onClose: () => void
  service: Service | null
  symbol: string
  onSaved: () => void
  staffName: string
  staffId: string | undefined
}

function ServiceModal({ open, onClose, service, symbol, onSaved, staffName, staffId }: ServiceModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(service?.name || '')
      setDescription(service?.description || '')
      setPrice(service ? String(service.default_price) : '')
      setIsActive(service?.is_active ?? true)
      setError(null)
    }
  }, [open, service])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Service name is required.'); return }
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) { setError('Default price must be a valid non-negative number.'); return }

    setSaving(true)
    const payload = {
      name: name.trim(),
      description: description.trim(),
      default_price: priceNum,
      is_active: isActive,
    }

    let resultError: string | null = null
    if (service) {
      const { error } = await supabase.from('services').update(payload).eq('id', service.id)
      if (error) resultError = error.message
      else await logAudit('update_service', 'service', service.id, payload, staffName, staffId)
    } else {
      const { error } = await supabase.from('services').insert(payload)
      if (error) resultError = error.message
      else await logAudit('create_service', 'service', '', payload, staffName, staffId)
    }
    setSaving(false)
    if (resultError) { setError(resultError); return }
    toast.success(service ? 'Service updated.' : 'Service created.')
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title={service ? 'Edit Service' : 'Add Service'} description={service ? `Updating "${service.name}"` : 'Create a new billable service'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}
        <div>
          <label className="label" htmlFor="svc-name">Service Name</label>
          <input id="svc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Consultation" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="svc-desc">Description</label>
          <textarea id="svc-desc" className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
        </div>
        <div>
          <label className="label" htmlFor="svc-price">Default Price ({symbol})</label>
          <input id="svc-price" type="number" step="0.01" min="0" className="input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
          <span className="text-sm text-slate-700">Active (available for billing)</span>
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : (service ? 'Save Changes' : 'Create Service')}</button>
        </div>
      </form>
    </Modal>
  )
}
