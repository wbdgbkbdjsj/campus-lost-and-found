import request from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'

/**
 * 认领申请接口（学生提交：金道轩 / 审核流转：李子研）
 * TODO(契约 v0)：路径与字段以《api-contract-v0.md》为准
 */
export function createClaim(data: unknown) {
  return request.post<number>('/claims', data)
}

export function pageMyClaims(params: PageQuery) {
  return request.get<PageResult<unknown>>('/claims/my', { params })
}

export function cancelClaim(id: number | string, reason?: string) {
  return request.put<void>(`/claims/${id}/cancel`, { reason })
}

export function getClaim(id: number | string) {
  return request.get<unknown>(`/claims/${id}`)
}
