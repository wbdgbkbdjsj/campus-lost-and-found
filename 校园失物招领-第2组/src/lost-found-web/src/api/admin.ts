import request from '@/utils/request'
import type {
  AuditLog,
  Category,
  ListResult,
  Location,
  PageQuery,
  StatsOverview,
  SysUser,
  UserStatus
} from '@/types'

/**
 * 后台管理接口（契约 v1 §3.4 #25-#30，super_admin）。
 *
 * 原型未实现这一段，前端按契约接；页面联调前需后端补齐。
 * 契约里没有 /admin/items、/admin/claims、/admin/notices、/admin/settings，
 * 对应页面不要自己编路径。
 */
export function pageUsers(params: PageQuery) {
  return request.get<ListResult<SysUser>>('/admin/users', { params })
}

/** 启用 / 停用账号 */
export function setUserStatus(id: number | string, status: UserStatus) {
  return request.put<void>(`/admin/users/${id}/status`, { status })
}

export function getAdminCategories() {
  return request.get<Category[]>('/admin/dict/categories')
}

export function createCategory(data: Pick<Category, 'name'> & { sort_order?: number }) {
  return request.post<Category>('/admin/dict/categories', data)
}

export function getAdminLocations() {
  return request.get<Location[]>('/admin/dict/locations')
}

export function createLocation(data: Pick<Location, 'name'> & { sort_order?: number }) {
  return request.post<Location>('/admin/dict/locations', data)
}

export function getStatsOverview(params?: { date_range?: string }) {
  return request.get<StatsOverview>('/admin/stats/overview', { params })
}

export function pageAuditLogs(params: PageQuery) {
  return request.get<ListResult<AuditLog>>('/admin/audit-logs', { params })
}

/** 认领单导出（契约 #30 文件名为 claims.xlsx） */
export function exportClaims(params?: { date_range?: string }) {
  return request.get<Blob>('/admin/export/claims.xlsx', {
    params,
    responseType: 'blob'
  })
}
