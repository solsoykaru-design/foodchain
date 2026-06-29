/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const isConfigured = !!(supabaseUrl && supabaseAnonKey)

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

function guardConfigured() {
  if (!supabase) throw new Error('Supabase не настроен. Задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.')
}

export async function signIn(email: string, password: string) {
  guardConfigured()
  const { data, error } = await supabase!.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string, metadata?: Record<string, any>) {
  guardConfigured()
  const { data, error } = await supabase!.auth.signUp({
    email,
    password,
    options: { data: metadata },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  guardConfigured()
  const { error } = await supabase!.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  guardConfigured()
  const { data, error } = await supabase!.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getUser() {
  guardConfigured()
  const { data, error } = await supabase!.auth.getUser()
  if (error) return null
  return data.user
}
