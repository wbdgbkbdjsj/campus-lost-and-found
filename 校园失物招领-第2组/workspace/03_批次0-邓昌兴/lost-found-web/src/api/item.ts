import request from '@/utils/request'
import type {
  FoundItem,
  FoundItemCreate,
  ListResult,
  LostItem,
  LostItemCreate,
  PageQuery
} from '@/types'

/**
 * 物品接口（契约 v1 §3.2 #7-#11）。
 * 路径一律相对 /api/v1，由 vite proxy 补前缀。
 */
export function pageFoundItems(params: PageQuery) {
  return request.get<ListResult<FoundItem>>('/found-items', { params })
}

export function getFoundItem(id: number | string) {
  return request.get<FoundItem>(`/found-items/${id}`)
}

/** 新建拾获登记，后端直接返回登记后的物品（状态 REGISTERED） */
export function createFoundItem(data: FoundItemCreate) {
  return request.post<FoundItem>('/found-items', data)
}

export function pageLostItems(params: PageQuery) {
  return request.get<ListResult<LostItem>>('/lost-items', { params })
}

/** 新建失物启事，后端只返回 { id, status }（状态 OPEN） */
export function createLostItem(data: LostItemCreate) {
  return request.post<Pick<LostItem, 'id' | 'status'>>('/lost-items', data)
}
