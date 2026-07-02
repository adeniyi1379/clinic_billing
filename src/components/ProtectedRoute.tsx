import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { FullPageSpinner } from './ui/Spinner'
import type { Permission } from '../lib/permissions'
import { hasPermission } from '../lib/permissions'

interface ProtectedRouteProps {
  children: React.ReactNode
  permission?: Permission
}

export function ProtectedRoute({ children, permission }: ProtectedRouteProps) {
  const { session, staff, loading } = useAuthStore()

  if (loading) return <FullPageSpinner />
  if (!session || !staff) return <Navigate to="/login" replace />
  if (staff && !staff.is_active) return <Navigate to="/login" replace />

  if (permission && !hasPermission(staff.role, permission)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
