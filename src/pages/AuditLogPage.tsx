import { useEffect, useState, useCallback } from 'react'
import { ScrollText, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { AuditLogEntry } from '../lib/types'
import { formatDateTime } from '../lib/format'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'

const PAGE_SIZE = 30

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('audit_log').select('*', { count: 'exact' })
    if (search.trim()) {
      query = query.or(`action.ilike.%${search.trim()}%,staff_name.ilike.%${search.trim()}%,entity_type.ilike.%${search.trim()}%`)
    }
    query = query.order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    const { data, error, count } = await query
    if (error) console.error(error)
    setEntries((data as AuditLogEntry[]) || [])
    setTotal(count || 0)
    setLoading(false)
  }, [search, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
        <p className="text-sm text-slate-500 mt-0.5">Append-only record of important actions.</p>
      </div>

      <div className="card">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" className="input pl-9" placeholder="Search by action, staff, or entity..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size={24} /></div>
        ) : entries.length === 0 ? (
          <EmptyState icon={ScrollText} title="No audit entries" description={search ? "Try a different search." : "Actions will appear here."} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="table-header">Timestamp</th>
                    <th className="table-header">Action</th>
                    <th className="table-header">Staff</th>
                    <th className="table-header">Entity</th>
                    <th className="table-header">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors align-top">
                      <td className="table-cell text-slate-500 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                      <td className="table-cell">
                        <span className="badge bg-slate-100 text-slate-700 font-mono text-xs">{e.action}</span>
                      </td>
                      <td className="table-cell font-medium text-slate-800">{e.staff_name || '—'}</td>
                      <td className="table-cell text-slate-600">
                        {e.entity_type && <span className="text-xs text-slate-500">{e.entity_type}</span>}
                        {e.entity_id && <span className="block font-mono text-xs text-slate-400 truncate max-w-[120px]">{e.entity_id}</span>}
                      </td>
                      <td className="table-cell text-slate-500 max-w-xs">
                        <pre className="text-xs whitespace-pre-wrap break-words font-mono">{Object.keys(e.details || {}).length > 0 ? JSON.stringify(e.details, null, 0) : '—'}</pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between p-4 border-t border-slate-200 text-sm">
              <span className="text-slate-500">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span className="px-3 py-2 text-slate-600">Page {page + 1} of {totalPages || 1}</span>
                <button className="btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
