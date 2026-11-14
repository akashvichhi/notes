import type { IUser } from '@src/types/api'
import type { ILoginCredentials, IRegisterCredentials } from '@src/types/auth'

import { api, ensureCsrf } from './api_client'



export async function fetchMe(): Promise<IUser> {
  const { data } = await api.get<{ data: IUser }>('/me')
  return data.data
}

export async function login(payload: ILoginCredentials): Promise<IUser> {
  await ensureCsrf()
  const { data } = await api.post<{ data: IUser }>('/login', payload)
  return data.data
}

export async function register(payload: IRegisterCredentials): Promise<IUser> {
  await ensureCsrf()
  const { data } = await api.post<{ data: IUser }>('/register', payload)
  return data.data
}

export async function logout(): Promise<void> {
  await api.post('/logout')
}

export async function updateProfile(payload: { name?: string; email?: string }): Promise<IUser> {
  const { data } = await api.patch<{ data: IUser }>('/me', payload)
  return data.data
}

export async function updatePassword(payload: {
  current_password:      string
  password:              string
  password_confirmation: string
}): Promise<void> {
  await api.put('/me/password', payload)
}
