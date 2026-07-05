import { normalizeOrigin } from '../seo-files/url';

/** 把用户输入规整为 host[:port](去协议/路径/查询)。失败时由 normalizeOrigin 抛错。 */
function toHost(input: string): string {
  return new URL(normalizeOrigin(input)).host;
}

/** Ahrefs Backlink Checker:固定 mode=subdomains。 */
export function buildBacklinkCheckerUrl(input: string): string {
  const host = toHost(input);
  return `https://ahrefs.com/backlink-checker/?input=${encodeURIComponent(host)}&mode=subdomains`;
}

/** Ahrefs Website Authority Checker。 */
export function buildWebsiteAuthorityCheckerUrl(input: string): string {
  const host = toHost(input);
  return `https://ahrefs.com/website-authority-checker/?input=${encodeURIComponent(host)}`;
}
