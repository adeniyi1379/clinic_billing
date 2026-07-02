import { create } from 'zustand'
import { useEffect } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastStore {
  toasts: Toast[]
  add: (type: ToastType, message: string) => void
  remove: (id: string) => void
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (type, message) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export function toast(message: string, type: ToastType = 'success') {
  useToastStore.getState().add(type, message)
}

toast.success = (m: string) => useToastStore.getState().add('success', m)
toast.error = (m: string) => useToastStore.getState().add('error', m)
toast.info = (m: string) => useToastStore.getState().add('info', m)

export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {}, [])

  const config = {
    success: { icon: CheckCircle, bg: 'bg-brand-50', border: 'border-brand-200', text: 'text-brand-800', iconColor: 'text-brand-600' },
    error: { icon: AlertCircle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', iconColor: 'text-red-600' },
    info: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', iconColor: 'text-blue-600' },
  }[toast.type]

  const Icon = config.icon

  return (
    <div className={`flex items-start gap-3 ${config.bg} ${config.border} border rounded-lg px-4 py-3 shadow-md animate-slide-in`}>
      <Icon size={18} className={`${config.iconColor} flex-shrink-0 mt-0.5`} />
      <p className={`text-sm ${config.text} flex-1`}>{toast.message}</p>
      <button onClick={onClose} className={`${config.text} opacity-50 hover:opacity-100`}>
        <X size={14} />
      </button>
    </div>
  )
}
