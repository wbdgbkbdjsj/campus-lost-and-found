import request from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'

/**
 * 后台端接口（欧阳昊天负责）
 * TODO(契约 v0)：路径与字段以《api-contract-v0.md》为准
 */
export function getDashboardStats() {
  return request.get<unknown>('/admin/stats')
}

export function pageUsers(params: PageQuery) {
  return request.get<PageResult<unknown>>('/admin/users', { params })
}

export function createUser(data: unknown) {
  return request.post<number>('/admin/users', data)
}

export function updateUser(id: number | string, data: unknown) {
  return request.put<void>(`/admin/users/${id}`, data)
}

export function setUserStatus(id: number | string, enabled: boolean) {
  return request.put<void>(`/admin/users/${id}/status`, { enabled })
}

export function resetUserPassword(id: number | string, password: string) {
  return request.put<void>(`/admin/users/${id}/password`, { password })
}

export function pageCategories(params?: PageQuery) {
  return request.get<PageResult<unknown>>('/admin/categories', { params })
}

export function createCategory(data: unknown) {
  return request.post<number>('/admin/categories', data)
}

export function updateCategory(id: number | string, data: unknown) {
  return request.put<void>(`/admin/categories/${id}`, data)
}

export function deleteCategory(id: number | string) {
  return request.delete<void>(`/admin/categories/${id}`)
}

export function pageAdminItems(params: PageQuery) {
  return request.get<PageResult<unknown>>('/admin/items', { params })
}

export function pageAdminClaims(params: PageQuery) {
  return request.get<PageResult<unknown>>('/admin/claims', { params })
}

export function pageNotices(params: PageQuery) {
  return request.get<PageResult<unknown>>('/admin/notices', { params })
}

export function createNotice(data: unknown) {
  return request.post<number>('/admin/notices', data)
}

export function updateNotice(id: number | string, data: unknown) {
  return request.put<void>(`/admin/notices/${id}`, data)
}

export function deleteNotice(id: number | string) {
  return request.delete<void>(`/admin/notices/${id}`)
}

export function pageLogs(params: PageQuery) {
  return request.get<PageResult<unknown>>('/admin/logs', { params })
}

export function getSettings() {
  return request.get<unknown>('/admin/settings')
}

export function updateSettings(data: unknown) {
  return request.put<void>('/admin/settings', data)
}
