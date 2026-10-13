import type { User } from '@/types/api'

import { api, ensureCsrf } from './client'

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<{ data: User }>('/me')
  return data.data
}

export async function login(payload: { email: string; password: string }): Promise<User> {
  await ensureCsrf()
  const { data } = await api.post<{ data: User }>('/login', payload)
  return data.data
}

export async function register(payload: {
  name: string
  email: string
  password: string
  password_confirmation: string
}): Promise<User> {
  await ensureCsrf()
  const { data } = await api.post<{ data: User }>('/register', payload)
  return data.data
}

export async function logout(): Promise<void> {
  await api.post('/logout')
}

export async function updateProfile(payload: { name?: string; email?: string }): Promise<User> {
  const { data } = await api.patch<{ data: User }>('/me', payload)
  return data.data
}

export async function updatePassword(payload: {
  current_password: string
  password: string
  password_confirmation: string
}): Promise<void> {
  await api.put('/me/password', payload)
}
