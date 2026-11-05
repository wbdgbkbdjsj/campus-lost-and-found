import request from '@/utils/request'
import type {
  ActionPayload,
  Claim,
  ListResult,
  ReviewQueueItem,
  VerifyPayload
} from '@/types'

/**
 * 审核状态流接口（契约 v1 §3.3 #17-#24，B 端核心）。
 *
 * 状态迁移与按钮显隐以后端返回的 allowed_events 为准，前端不重写状态机。
 * 契约 v1 没有 /audit/stats、/audit/records：统计走 /admin/stats/overview，
 * 审核流水从 GET /claims/{id} 的 records 字段取。
 */
export function getReviewQueue() {
  return request.get<ListResult<ReviewQueueItem>>('/review/queue')
}

/** SUBMITTED → UNDER_REVIEW，锁定接单人 */
export function acceptClaim(id: number | string) {
  return request.post<Claim>(`/review/claims/${id}/accept`)
}

/** 身份核验（#19）：不改状态，只写 VERIFY 流水；结果 { verified } */
export function verifyClaim(id: number | string, data: VerifyPayload) {
  return request.post<{ verified: boolean }>(`/review/claims/${id}/verify`, data)
}

/** UNDER_REVIEW → APPROVED，物品 → PICKUP_PENDING，deadline +7d */
export function approveClaim(id: number | string, comment = '') {
  return request.post<Claim>(`/review/claims/${id}/approve`, { comment })
}

/** 驳回，comment 必填 */
export function rejectClaim(id: number | string, comment: string) {
  return request.post<Claim>(`/review/claims/${id}/reject`, { comment })
}

/** 退回补充，comment 必填，deadline +7d */
export function requestInfo(id: number | string, comment: string) {
  return request.post<Claim>(`/review/claims/${id}/request-info`, { comment })
}

/** APPROVED → COMPLETED；前置条件：VERIFY 已通过（I7），物品 → CLAIMED */
export function handoverClaim(id: number | string, data?: ActionPayload) {
  return request.post<Claim>(`/review/claims/${id}/handover`, data ?? {})
}

/** 超时批处理：PENDING_INFO / APPROVED → EXPIRED，now 仅测试用 */
export function runExpire(now?: string) {
  return request.post<{ expired: number; ids: number[] }>(
    '/review/expire-run',
    now ? { now } : {}
  )
}
