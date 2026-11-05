import request from '@/utils/request'
import type { Claim, ClaimCreate, ClaimDetail, ListResult } from '@/types'

/**
 * 认领申请接口（契约 v1 §3.2 #12-#16）。
 *
 * 注意：撤销走 B 端路由 POST /review/claims/{id}/cancel（契约 #16），
 * 不是 PUT /claims/{id}/cancel。
 */
export function createClaim(data: ClaimCreate) {
  return request.post<Claim>('/claims', data)
}

/** 我的认领单（scope=mine） */
export function pageMyClaims() {
  return request.get<ListResult<Claim>>('/claims', { params: { scope: 'mine' } })
}

/** 详情含完整审核流水 records */
export function getClaim(id: number | string) {
  return request.get<ClaimDetail>(`/claims/${id}`)
}

/** 待补充材料 → 重新进入审核（PENDING_INFO → UNDER_REVIEW） */
export function supplementClaim(id: number | string, proof: string) {
  return request.post<Claim>(`/claims/${id}/supplement`, { proof })
}

/** 申请人撤销（非终态 → CANCELLED） */
export function cancelClaim(id: number | string, comment = '') {
  return request.post<Claim>(`/review/claims/${id}/cancel`, { comment })
}
