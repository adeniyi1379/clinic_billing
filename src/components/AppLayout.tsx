import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  LayoutDashboard,
  FilePlus2,
  Receipt,
  ListChecks,
  BarChart3,
  Settings,
  Users,
  Stethoscope,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  ScrollText,
} from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { hasPermission, type Permission } from '../lib/permissions'
import { ROLE_LABELS } from '../lib/types'
import { toast } from './ui/Toast'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  permission: Permission
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'view_dashboard' },
  { to: '/billing', label: 'New Bill', icon: FilePlus2, permission: 'create_transaction' },
  { to: '/transactions', label: 'Transactions', icon: ListChecks, permission: 'view_transactions' },
  { to: '/services', label: 'Services', icon: Stethoscope, permission: 'manage_services' },
  { to: '/reports', label: 'Reports', icon: BarChart3, permission: 'view_reports' },
  { to: '/users', label: 'User Management', icon: Users, permission: 'manage_users' },
  { to: '/settings', label: 'Settings', icon: Settings, permission: 'manage_settings' },
  { to: '/audit-log', label: 'Audit Log', icon: ScrollText, permission: 'view_audit_log' },
]

export function AppLayout() {
  const { staff, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(staff?.role, item.permission))

  const handleSignOut = async () => {
    await signOut()
    toast.info('You have been signed out.')
    navigate('/login')
  }

  const initials = (staff?.full_name || '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex w-64 flex-col bg-brand-900 text-white fixed inset-y-0 left-0 z-30">
        <SidebarContent
          items={visibleItems}
          onSignOut={handleSignOut}
          staffName={staff?.full_name || ''}
          staffRole={staff?.role}
          initials={initials}
        />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-brand-900 text-white animate-slide-in">
            <SidebarContent
              items={visibleItems}
              onSignOut={handleSignOut}
              staffName={staff?.full_name || ''}
              staffRole={staff?.role}
              initials={initials}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
          <button
            className="lg:hidden text-slate-600 hover:bg-slate-100 p-2 rounded-lg"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          {/* <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500">
            <ShieldCheck size={16} className="text-brand-600" />
            <span>Role-Based Access Control enabled</span>
          </div> */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-700">{staff?.full_name}</p>
              <p className="text-xs text-slate-500">{staff ? ROLE_LABELS[staff.role] : ''}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-semibold">
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

interface SidebarContentProps {
  items: NavItem[]
  onSignOut: () => void
  staffName: string
  staffRole?: string
  initials: string
  onNavigate?: () => void
}

function SidebarContent({ items, onSignOut, staffName, staffRole, initials, onNavigate }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-brand-800">
        <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center">
          <Activity size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-none">PEAMAK</h1>
          <p className="text-brand-300 text-xs mt-0.5">Billing System</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-700 text-white'
                  : 'text-brand-100 hover:bg-brand-800 hover:text-white'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-brand-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{staffName}</p>
            <p className="text-brand-300 text-xs">{staffRole ? ROLE_LABELS[staffRole as keyof typeof ROLE_LABELS] : ''}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-brand-100 hover:bg-red-600 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  )
}
