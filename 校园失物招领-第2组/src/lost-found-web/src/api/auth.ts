import request from '@/utils/request'
import type { LoginResult, LoginUser } from '@/types'

/**
 * 认证接口（邓昌兴负责）
 * TODO(契约 v0)：路径与字段以《api-contract-v0.md》为准
 */
export interface LoginPayload {
  username: string
  password: string
}

export function login(data: LoginPayload) {
  return request.post<LoginResult>('/auth/login', data)
}

export function getProfile() {
  return request.get<LoginUser>('/auth/profile')
}

export function logout() {
  return request.post<void>('/auth/logout')
}
