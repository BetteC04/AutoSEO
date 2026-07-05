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

/** Yandex 结果页。 */
export function buildYandexSearchUrl(keyword: string): string {
  const kw = keyword.trim();
  if (!kw) throw new Error('keyword required');
  return `https://yandex.com/search/?text=${encodeURIComponent(kw)}`;
}
