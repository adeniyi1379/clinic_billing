import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Users, ShieldCheck, ShieldOff, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Staff, UserRole } from '../lib/types'
import { ROLE_LABELS } from '../lib/types'
import { useAuthStore } from '../store/auth'
import { logAudit } from '../lib/audit'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { toast } from '../components/ui/Toast'
import { formatDate } from '../lib/format'

interface StaffWithEmail extends Staff {
  email: string
}

export function UsersPage() {
  const staff = useAuthStore((s) => s.staff)
  const [users, setUsers] = useState<StaffWithEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StaffWithEmail | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StaffWithEmail | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=list`
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${session?.access_token || ''}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error('Failed to load users: ' + (err.error || res.statusText))
      setLoading(false)
      return
    }
    const data = await res.json()
    setUsers((data.users || []) as StaffWithEmail[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=delete`
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session?.access_token || ''}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: deleteTarget.id }),
    })
    setDeleting(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error('Failed to delete user: ' + (err.error || res.statusText))
      return
    }
    await logAudit('delete_user', 'staff', deleteTarget.id, { email: deleteTarget.email, name: deleteTarget.full_name }, staff?.full_name, staff?.id)
    toast.success('User deleted.')
    setDeleteTarget(null)
    load()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create staff accounts and assign roles.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" className="input pl-9" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No users found" description={search ? "Try a different search." : "Add your first staff member."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="table-header">Name</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Created</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="table-cell font-medium text-slate-800">
                      {u.full_name}
                      {u.id === staff?.id && <span className="ml-2 text-xs text-brand-600 font-normal">(you)</span>}
                    </td>
                    <td className="table-cell text-slate-500">{u.email}</td>
                    <td className="table-cell">
                      <span className={`badge ${
                        u.role === 'administrator' ? 'bg-brand-100 text-brand-700' :
                        u.role === 'accountant' ? 'bg-blue-100 text-blue-700' :
                        u.role === 'cashier' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{ROLE_LABELS[u.role]}</span>
                    </td>
                    <td className="table-cell">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-sm text-brand-600"><ShieldCheck size={14} /> Active</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm text-slate-400"><ShieldOff size={14} /> Inactive</span>
                      )}
                    </td>
                    <td className="table-cell text-slate-500">{formatDate(u.created_at)}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditTarget(u)} className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Edit">
                          <Pencil size={16} />
                        </button>
                        {u.id !== staff?.id && (
                          <button onClick={() => setDeleteTarget(u)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); load() }}
        staffName={staff?.full_name || ''}
        staffId={staff?.id}
      />

      <EditUserModal
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => { setEditTarget(null); load() }}
        staffName={staff?.full_name || ''}
        staffId={staff?.id}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Delete ${deleteTarget?.full_name} (${deleteTarget?.email})? This permanently removes their account.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  )
}

function CreateUserModal({ open, onClose, onSaved, staffName, staffId }: { open: boolean; onClose: () => void; onSaved: () => void; staffName: string; staffId: string | undefined }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('receptionist')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setFullName(''); setEmail(''); setPassword(''); setRole('receptionist'); setError(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!fullName.trim() || !email.trim() || !password) { setError('All fields are required.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setSaving(true)
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=create`
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token || ''}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim(), password, full_name: fullName.trim(), role }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setError(err.error || 'Failed to create user')
      setSaving(false)
      return
    }
    await logAudit('create_user', 'staff', '', { email, full_name: fullName, role }, staffName, staffId)
    toast.success('User created.')
    setSaving(false)
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add User" description="Create a new staff account">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}
        <div>
          <label className="label" htmlFor="cu-name">Full Name</label>
          <input id="cu-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="cu-email">Email</label>
          <input id="cu-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="cu-pass">Password</label>
          <input id="cu-pass" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
        </div>
        <div>
          <label className="label" htmlFor="cu-role">Role</label>
          <select id="cu-role" className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create User'}</button>
        </div>
      </form>
    </Modal>
  )
}

function EditUserModal({ target, onClose, onSaved, staffName, staffId }: { target: StaffWithEmail | null; onClose: () => void; onSaved: () => void; staffName: string; staffId: string | undefined }) {
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('receptionist')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (target) {
      setFullName(target.full_name)
      setRole(target.role)
      setIsActive(target.is_active)
      setError(null)
    }
  }, [target])

  if (!target) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=update`
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${session?.access_token || ''}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: target.id, full_name: fullName.trim(), role, is_active: isActive }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setError(err.error || 'Failed to update user')
      setSaving(false)
      return
    }
    await logAudit('update_user', 'staff', target.id, { full_name: fullName, role, is_active: isActive }, staffName, staffId)
    toast.success('User updated.')
    setSaving(false)
    onSaved()
  }

  return (
    <Modal open={!!target} onClose={onClose} title="Edit User" description={target.email}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}
        <div>
          <label className="label" htmlFor="eu-name">Full Name</label>
          <input id="eu-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="eu-role">Role</label>
          <select id="eu-role" className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
          <span className="text-sm text-slate-700">Active (can sign in)</span>
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  )
}
