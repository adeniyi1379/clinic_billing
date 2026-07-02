import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { HospitalSettings } from '../lib/types'

interface SettingsState {
  settings: HospitalSettings | null
  loading: boolean
  load: () => Promise<void>
  update: (patch: Partial<HospitalSettings>) => Promise<{ error: string | null }>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,
  load: async () => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('hospital_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    if (error) {
      console.error('Error loading settings:', error)
    }
    set({ settings: data as HospitalSettings | null, loading: false })
  },
  update: async (patch) => {
    const { data, error } = await supabase
      .from('hospital_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select()
      .maybeSingle()
    if (error) return { error: error.message }
    if (data) set({ settings: data as HospitalSettings })
    return { error: null }
  },
}))

export function getCurrencySymbol(): string {
  return useSettingsStore.getState().settings?.currency_symbol || '₦'
}
