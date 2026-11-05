/** 统一时间显示：兼容后端 yyyy-MM-dd HH:mm:ss 与 ISO 字符串 */
export function formatDateTime(value?: string | number | Date | null): string {
  if (!value) return '-'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 手机号脱敏：138****8888 */
export function maskPhone(phone?: string | null): string {
  if (!phone || phone.length < 7) return phone ?? '-'
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

/** 截断长文本（列表页描述用） */
export function ellipsis(text?: string | null, max = 40): string {
  if (!text) return '-'
  return text.length > max ? `${text.slice(0, max)}...` : text
}
