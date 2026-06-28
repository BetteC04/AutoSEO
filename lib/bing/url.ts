/**
 * 拼接 Bing Webmaster Tools「URL Inspection」页面 URL。
 *
 * 形如：`https://www.bing.com/webmasters/urlinspection?siteUrl=https%3A%2F%2F{domain}%2F`
 *
 * siteUrl 是下拉框选中项目的网址（完整带协议 + 结尾斜杠），作为请求参数；
 * 项目的 domain 是纯域名（见 lib/storage/projects 的 isValidDomain 校验）。
 *
 * @param domain 资源域名（如 `bottleneck-checker.com`），会被 trim。
 */
export function buildBingUrl(domain: string): string {
  const d = domain.trim();
  if (!d) throw new Error('domain required');
  const siteUrl = `https://${d}/`;
  return `https://www.bing.com/webmasters/urlinspection?siteUrl=${encodeURIComponent(siteUrl)}`;
}
