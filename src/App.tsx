import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ToastContainer } from './components/ui/Toast'
import { LoginPage } from './pages/LoginPage'
import { AppLayout } from './components/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ServicesPage } from './pages/ServicesPage'
import { BillingPage } from './pages/BillingPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { TransactionDetailPage } from './pages/TransactionDetailPage'
import { ReportsPage } from './pages/ReportsPage'
import { UsersPage } from './pages/UsersPage'
import { SettingsPage } from './pages/SettingsPage'
import { AuditLogPage } from './pages/AuditLogPage'

export default function App() {
  const init = useAuthStore((s) => s.init)
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)

  useEffect(() => {
    init()
  }, [init])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading System...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<ProtectedRoute permission="view_dashboard"><DashboardPage /></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute permission="create_transaction"><BillingPage /></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute permission="view_transactions"><TransactionsPage /></ProtectedRoute>} />
          <Route path="/transactions/:id" element={<ProtectedRoute permission="view_transactions"><TransactionDetailPage /></ProtectedRoute>} />
          <Route path="/services" element={<ProtectedRoute permission="manage_services"><ServicesPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute permission="view_reports"><ReportsPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute permission="manage_users"><UsersPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute permission="manage_settings"><SettingsPage /></ProtectedRoute>} />
          <Route path="/audit-log" element={<ProtectedRoute permission="view_audit_log"><AuditLogPage /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </>
  )
}
