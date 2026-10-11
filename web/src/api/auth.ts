import { api, ensureCsrf } from './client'
import type { User } from '@/types/api'

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
