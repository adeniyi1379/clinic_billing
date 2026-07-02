import { Loader2 } from 'lucide-react'

interface SpinnerProps {
  size?: number
  className?: string
}

export function Spinner({ size = 20, className = '' }: SpinnerProps) {
  return <Loader2 size={size} className={`animate-spin text-brand-600 ${className}`} />
}

export function FullPageSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-100">
      <Spinner size={32} />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}
