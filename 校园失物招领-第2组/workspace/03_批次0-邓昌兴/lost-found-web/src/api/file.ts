/**
 * 文件上传 —— 契约 v1 没有上传接口（30 条清单里不含 /files/upload）。
 *
 * 拾获登记里的 image_url 目前只能填外链；等契约补上传接口后再在这里接，
 * 不要在页面里硬编码一个不存在的路径。
 */
export function uploadFile(_file: File): Promise<never> {
  return Promise.reject(new Error('契约 v1 未提供文件上传接口，image_url 请填外链'))
}
