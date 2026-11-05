import request from '@/utils/request'
import type { LoginResult, LoginUser } from '@/types'

/**
 * 认证接口（契约 v1 #2-#3）
 * 登录参数是学号 student_no，不是 username。
 * 原型没有 logout 接口：退出登录只清理本地状态，见 stores/auth.ts。
 */
export interface LoginPayload {
  student_no: string
  password: string
}

export function login(data: LoginPayload) {
  return request.post<LoginResult>('/auth/login', data)
}

export function getProfile() {
  return request.get<LoginUser>('/auth/me')
}
