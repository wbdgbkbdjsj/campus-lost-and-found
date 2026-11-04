import request from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'

/**
 * 审核端接口（李子研负责）
 * TODO(契约 v0)：路径与字段以《api-contract-v0.md》为准
 */
export function getAuditStats() {
  return request.get<unknown>('/audit/stats')
}

export function pagePendingItems(params: PageQuery) {
  return request.get<PageResult<unknown>>('/audit/items/pending', { params })
}

export function approveItem(id: number | string) {
  return request.post<void>(`/audit/items/${id}/approve`)
}

export function rejectItem(id: number | string, reason: string) {
  return request.post<void>(`/audit/items/${id}/reject`, { reason })
}

export function pagePendingClaims(params: PageQuery) {
  return request.get<PageResult<unknown>>('/audit/claims/pending', { params })
}

export function approveClaim(id: number | string) {
  return request.post<void>(`/audit/claims/${id}/approve`)
}

export function rejectClaim(id: number | string, reason: string) {
  return request.post<void>(`/audit/claims/${id}/reject`, { reason })
}

export function pageAuditRecords(params: PageQuery) {
  return request.get<PageResult<unknown>>('/audit/records', { params })
}

export function registerReturn(claimId: number | string, data: unknown) {
  return request.post<void>(`/claims/${claimId}/return`, data)
}
