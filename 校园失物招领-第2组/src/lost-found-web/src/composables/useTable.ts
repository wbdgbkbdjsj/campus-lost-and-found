import { ref, type Ref } from 'vue'
import type { ListResult, PageQuery } from '@/types'

/**
 * 列表页通用分页逻辑（骨架版）。
 *
 * 后端口径（契约 v1）：分页参数是 page / size（从 1 开始），
 * 返回 { total, items } —— 不是 { records, current, size }。
 *
 * 用法：
 *   const { list, total, loading, query, load, search, reset } =
 *     useTable((q) => pageItems(q), { keyword: '' })
 *   onMounted(load)
 */
export function useTable<T>(
  fetcher: (query: PageQuery) => Promise<ListResult<T>>,
  initialQuery: PageQuery = {}
) {
  const list = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const loading = ref(false)
  const query = ref<PageQuery>({ page: 1, size: 10, ...initialQuery })

  async function load() {
    loading.value = true
    try {
      const result = await fetcher(query.value)
      list.value = result.items
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  /** 条件变化后从第一页重新查询 */
  function search() {
    query.value.page = 1
    return load()
  }

  function reset() {
    query.value = { page: 1, size: query.value.size ?? 10, ...initialQuery }
    return load()
  }

  function onPageChange(page: number) {
    query.value.page = page
    return load()
  }

  return { list, total, loading, query, load, search, reset, onPageChange }
}
