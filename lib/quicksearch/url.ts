/** Google 结果页直链（不含 gws_rd=ssl）。 */
export function buildGoogleSearchUrl(keyword: string): string {
  const kw = keyword.trim();
  if (!kw) throw new Error('keyword required');
  return `https://www.google.com/search?q=${encodeURIComponent(kw)}`;
}

/** Bing（cn.bing.com）结果页直链。 */
export function buildBingSearchUrl(keyword: string): string {
  const kw = keyword.trim();
  if (!kw) throw new Error('keyword required');
  return `https://cn.bing.com/search?q=${encodeURIComponent(kw)}`;
}
