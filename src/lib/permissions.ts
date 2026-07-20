import type { UserRole } from './types'

export type Permission =
  | 'view_dashboard'
  | 'view_transactions'
  | 'create_transaction'
  | 'edit_transaction'
  | 'delete_transaction'
  | 'print_receipt'
  | 'view_reports'
  | 'export_reports'
  | 'manage_services'
  | 'manage_users'
  | 'manage_settings'
  | 'view_audit_log'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  administrator: [
    'view_dashboard',
    'view_transactions',
    'create_transaction',
    'edit_transaction',
    'delete_transaction',
    'print_receipt',
    'view_reports',
    'export_reports',
    'manage_services',
    'manage_users',
    'manage_settings',
    'view_audit_log',
  ],
  cashier: [
    'view_transactions',
    'create_transaction',
    'print_receipt',
    'view_reports',
  ],
  receptionist: [
    'view_transactions',
    'create_transaction',
    'print_receipt',
  ],
  accountant: [
    'view_dashboard',
    'view_transactions',
    'edit_transaction',
    'delete_transaction',
    'print_receipt',
    'view_reports',
    'export_reports',
    'view_audit_log',
  ],
}

export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasAnyPermission(role: UserRole | undefined, permissions: Permission[]): boolean {
  if (!role) return false
  return permissions.some((p) => hasPermission(role, p))
}
