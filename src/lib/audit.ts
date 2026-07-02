import { supabase } from './supabase'

export async function logAudit(
  action: string,
  entityType: string = '',
  entityId: string = '',
  details: Record<string, unknown> = {},
  staffName: string = '',
  staffId: string | null = null,
): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      staff_name: staffName,
      staff_id: staffId,
    })
  } catch (err) {
    console.error('Failed to write audit log:', err)
  }
}
