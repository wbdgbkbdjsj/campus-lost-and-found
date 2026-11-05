/**
 * 待交接单的本地缓存（演示辅助）
 *
 * 说明：契约 v1 没有「查询 APPROVED 待交接认领单列表」的接口——
 * GET /review/queue 只返回 SUBMITTED / PENDING_INFO，APPROVED 不在其中。
 * 为了让「归还登记」页在演示时能直接拿到刚审核通过的单子，
 * 审核通过成功后把单号写入 localStorage，交接完成后移除。
 *
 * 这是纯前端的便利缓存，不是业务数据源：
 * 缓存丢了不影响业务，页面上仍支持手动输入单号调取。
 */

const STORAGE_KEY = 'lf_pending_handover'

function read(): number[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'number') : []
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return []
  }
}

function write(ids: number[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

/** 审核通过后登记一条待交接单号（去重，最新的排前面） */
export function pushPendingHandover(id: number) {
  const ids = read().filter((one) => one !== id)
  write([id, ...ids].slice(0, 20))
}

/** 读取待交接单号列表 */
export function listPendingHandover(): number[] {
  return read()
}

/** 交接完成后清理 */
export function removePendingHandover(id: number) {
  write(read().filter((one) => one !== id))
}
