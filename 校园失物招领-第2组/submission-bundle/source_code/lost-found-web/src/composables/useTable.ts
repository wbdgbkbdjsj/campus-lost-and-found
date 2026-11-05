import { ref, type Ref } from 'vue'
import type { PageQuery, PageResult } from '@/types'

/**
 * 列表页通用分页逻辑（骨架版）。
 *
 * 用法：
 *   const { list, total, loading, query, load, search, reset } =
 *     useTable((q) => pageItems(q), { keyword: '' })
 *   onMounted(load)
 */
export function useTable<T>(
  fetcher: (query: PageQuery) => Promise<PageResult<T>>,
  initialQuery: PageQuery = {}
) {
  const list = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const loading = ref(false)
  const query = ref<PageQuery>({ current: 1, size: 10, ...initialQuery })

  async function load() {
    loading.value = true
    try {
      const result = await fetcher(query.value)
      list.value = result.records
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  /** 条件变化后从第一页重新查询 */
  function search() {
    query.value.current = 1
    return load()
  }

  function reset() {
    query.value = { current: 1, size: query.value.size ?? 10, ...initialQuery }
    return load()
  }

  function onPageChange(page: number) {
    query.value.current = page
    return load()
  }

  return { list, total, loading, query, load, search, reset, onPageChange }
}
