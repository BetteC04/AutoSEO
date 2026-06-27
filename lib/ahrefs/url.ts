export interface Country {
  code: string;
  label: string;
}

export const COUNTRIES: Country[] = [
  { code: 'us', label: '美国 (US)' },
  { code: 'uk', label: '英国 (UK)' },
  { code: 'au', label: '澳洲 (AU)' },
  { code: 'ca', label: '加拿大 (CA)' },
  { code: 'in', label: '印度 (IN)' },
  { code: 'de', label: '德国 (DE)' },
  { code: 'fr', label: '法国 (FR)' },
  { code: 'jp', label: '日本 (JP)' },
  { code: 'br', label: '巴西 (BR)' },
  { code: 'es', label: '西班牙 (ES)' },
];

const CC_RE = /^[a-z]{2}$/i;
export function isValidCountryCode(c: string): boolean {
  return CC_RE.test(c);
}

export function buildAhrefsUrl(country: string, keyword: string): string {
  const cc = country.trim().toLowerCase();
  if (!isValidCountryCode(cc)) throw new Error('invalid country code');
  const kw = keyword.trim();
  if (!kw) throw new Error('keyword required');
  return `https://ahrefs.com/keyword-difficulty/?country=${cc}&input=${encodeURIComponent(kw)}`;
}
