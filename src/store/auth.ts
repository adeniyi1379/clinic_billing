import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Staff, UserRole } from '../lib/types'

interface AuthState {
  session: Session | null
  user: User | null
  staff: Staff | null
  loading: boolean
  error: string | null
  init: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshStaff: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  staff: null,
  loading: true,
  error: null,

  init: async () => {
    set({ loading: true })
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const staff = await fetchStaff(session.user.id)
      set({ session, user: session.user, staff, loading: false })
    } else {
      set({ session: null, user: null, staff: null, loading: false })
    }

    supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const staff = await fetchStaff(session?.user.id ?? '')
          set({ session, user: session?.user ?? null, staff, loading: false })
        } else if (event === 'SIGNED_OUT') {
          set({ session: null, user: null, staff: null, loading: false })
        }
      })()
    })
  },

  signIn: async (email, password) => {
    set({ error: null })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      set({ error: error.message })
      return { error: error.message }
    }
    if (data.user) {
      const staff = await fetchStaff(data.user.id)
      if (staff && !staff.is_active) {
        await supabase.auth.signOut()
        set({ session: null, user: null, staff: null, error: 'Your account has been deactivated. Contact an administrator.' })
        return { error: 'Your account has been deactivated. Contact an administrator.' }
      }
      set({ session: data.session, user: data.user, staff })
    }
    return { error: null }
  },

  signUp: async (email, password, fullName) => {
    set({ error: null })
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) {
      set({ error: error.message })
      return { error: error.message }
    }
    if (data.user) {
      const staff = await fetchStaff(data.user.id)
      set({ session: data.session, user: data.user, staff })
    }
    return { error: null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, staff: null })
  },

  refreshStaff: async () => {
    const user = get().user
    if (!user) return
    const staff = await fetchStaff(user.id)
    set({ staff })
  },

  clearError: () => set({ error: null }),
}))

async function fetchStaff(userId: string): Promise<Staff | null> {
  if (!userId) return null
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.error('Error fetching staff:', error)
    return null
  }
  return data as Staff | null
}

export function useCurrentRole(): UserRole | undefined {
  return useAuthStore((s) => s.staff?.role)
}
