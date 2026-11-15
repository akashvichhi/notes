import { API_ENDPOINTS } from '@src/constants/api_endpoints'
import type { IUser } from '@src/types/api'
import type { IDataResponse } from '@src/types/api_response'
import type { ILoginCredentials, IProfileUpdate, IRegisterCredentials } from '@src/types/auth'

import { api } from './api_client'



export async function fetchMe(): Promise<IUser> {
  const { data } = await api.get<IDataResponse<IUser>>(API_ENDPOINTS.CURRENT_USER)
  return data.data
}

export async function login(payload: ILoginCredentials): Promise<IUser> {
  const { data } = await api.post<IDataResponse<IUser>>(API_ENDPOINTS.LOGIN, payload)
  return data.data
}

export async function register(payload: IRegisterCredentials): Promise<IUser> {
  const { data } = await api.post<IDataResponse<IUser>>(API_ENDPOINTS.REGISTER, payload)
  return data.data
}

export async function logout(): Promise<void> {
  await api.post(API_ENDPOINTS.LOGOUT)
}

export async function updateProfile(payload: IProfileUpdate): Promise<IUser> {
  const { data } = await api.patch<IDataResponse<IUser>>(API_ENDPOINTS.PROFILE, payload)
  return data.data
}

export async function updatePassword(payload: {
  currentPassword:      string
  password:             string
  passwordConfirmation: string
}): Promise<void> {
  await api.put(API_ENDPOINTS.PASSWORD, payload)
}
