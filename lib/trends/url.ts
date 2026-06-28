export const TRENDS_DATE_RANGES = [
  { value: 'now 7-d', label: '7 天' },
  { value: 'today 1-m', label: '30 天' },
  { value: 'today 1-y', label: '1 年' },
] as const;

export const TRENDS_GEOS = [
  { value: 'Worldwide', label: '全球' },
  { value: 'US', label: '美国 (US)' },
  { value: 'GB', label: '英国 (UK)' },
  { value: 'JP', label: '日本 (JP)' },
  { value: 'DE', label: '德国 (DE)' },
  { value: 'FR', label: '法国 (FR)' },
  { value: 'IN', label: '印度 (IN)' },
  { value: 'BR', label: '巴西 (BR)' },
  { value: 'CA', label: '加拿大 (CA)' },
  { value: 'AU', label: '澳洲 (AU)' },
] as const;

/** 拼 Google Trends explore 链接。compare 为空时只查主词（不带逗号）。 */
export function buildTrendsUrl(keyword: string, compare: string, date: string, geo: string): string {
  const kw = keyword.trim();
  if (!kw) throw new Error('keyword required');
  const cmp = compare.trim();
  const q = cmp ? `${kw},${cmp}` : kw;
  return `https://trends.google.com/explore?q=${encodeURIComponent(q)}&date=${encodeURIComponent(date)}&geo=${encodeURIComponent(geo)}`;
}
