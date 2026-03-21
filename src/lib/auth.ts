import type { Session } from '@supabase/supabase-js'
import { isSupabaseEnabled, supabase } from './supabase'

const ensureClient = () => {
  if (!isSupabaseEnabled || !supabase) {
    throw new Error('Supabase desabilitado')
  }
  return supabase
}

export const getSession = async () => {
  const client = ensureClient()
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  return data.session
}

export const onAuthStateChange = (handler: (session: Session | null) => void) => {
  const client = ensureClient()
  const { data } = client.auth.onAuthStateChange((_event, session) => handler(session))
  return () => data.subscription.unsubscribe()
}

export const signInWithGoogle = async () => {
  const client = ensureClient()
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export const signOut = async () => {
  const client = ensureClient()
  const { error } = await client.auth.signOut()
  if (error) throw error
}
