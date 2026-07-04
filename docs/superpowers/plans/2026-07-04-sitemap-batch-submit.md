# Sitemap 批量提交 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「网站提交」面板的手动粘贴 URL 改为「输入 sitemap.xml → 自动抓取全量链接 → 从未提交池随机选 10 个 → 提交至 GSC/Bing → 落本地记录去重 → 列出批次报告」。

**Architecture:** 方案 A——background service worker 负责 fetch + 递归解析 sitemap（经独立 `sitemap-fetcher` port），sidepanel 持有策略与状态（链接库、提交记录、随机选择、报告）。GSC/Bing 的 CDP 提交链路（`lib/gsc/flow.ts`、`lib/bing/flow.ts`、`background.ts` 的 `handleStart/handleBingStart`）完全不动。

**Tech Stack:** WXT + React 19 + TypeScript，vitest + @testing-library/react，chrome.storage.local。

## Global Constraints

（每个任务的需求都隐含包含本节）

- **存储**：`chrome.storage.local`，按 `domain` 隔离。key 分别为 `discovered:${domain}`（链接库）与 `submissions:${domain}`（提交记录数组）。沿用 `lib/storage/projects.ts` 的读写范式。
- **sitemap 解析方式**：**正则**（MV3 service worker 无 DOM API，`DOMParser` 不可用），`<loc>` 要剥离 `<![CDATA[…]]>` 与首尾空白。
- **同 host 过滤**：递归抓取只保留 `new URL(loc).host === new URL(entryUrl).host` 的 `<loc>`（含子 sitemap URL 本身）。
- **去重粒度**：按 `(domain, url, platform)`，**仅 `status === 'ok'` 计入黑名单**（"配额""已索引"等 skipped 不进黑名单，可重试）。
- **候选池**：`discovered.urls` 中「对所有勾选平台都未 ok」的 URL；`pickRandom(pool, 10)`，不足 10 全选，池空则不提交。
- **报告分类（反向枚举，覆盖动态 reason）**：
  - 成功 = `status === 'ok'`
  - 跳过 = `status === 'skipped'` 且 `reason ∈ SKIP_REASONS`
  - 失败 = `status === 'skipped'` 且 `reason ∉ SKIP_REASONS`（兜底含动态诊断 reason 与步骤异常）
  - `SKIP_REASONS = ['已索引', '不属于此域名', '配额', '未执行（批次终止）']`（与 `lib/gsc/flow.ts` / `lib/bing/flow.ts` 现有产出一致）
- **不动**：`lib/gsc/*`、`lib/bing/*`、`background.ts` 的 GSC/Bing port 处理（`handleStart` / `handleBingStart`）。
- **测试**：vitest，`tests/setup.ts` 已内置 `chrome.storage.local` 内存实现（每测自动 reset）+ `chrome.runtime.connect` 占位 mock。alias：`@lib` / `@components` / `@hooks` / `@pages`。
- **命令**：`pnpm test`（全量）/ `pnpm test -- <file>`（单文件）/ `pnpm compile`（tsc --noEmit）。
- **提交风格**：`feat(scope): …` / `refactor(scope): …` / `docs(scope): …`，每个任务末尾各 commit 一次。

---

## 文件结构总览

| 文件 | 责任 | 任务 |
|---|---|---|
| `lib/sitemap/parse.ts` | 纯函数：XML 文本 → `{ kind, locs }` | Task 1 |
| `lib/sitemap/fetch.ts` | 递归 fetch + 同 host 过滤 + 守卫 | Task 2 |
| `lib/storage/discovered.ts` | 链接库 CRUD | Task 3 |
| `lib/storage/submissions.ts` | 提交记录 + 去重判定 | Task 4 |
| `lib/submit/reasons.ts` | SKIP_REASONS 常量 + `classifyResult` | Task 5 |
| `lib/submit/pick.ts` | `pickRandom` Fisher-Yates | Task 5 |
| `lib/messaging/types.ts` | 追加 `SitemapRequest` / `SitemapEvent` | Task 6 |
| `lib/messaging/protocol.ts` | 追加 `SITEMAP_PORT_NAME` / `createSitemapPort` | Task 6 |
| `lib/sitemap/handler.ts` | `handleSitemapRequest` 纯函数（可单测） | Task 7 |
| `entrypoints/background.ts` | 追加 `sitemap-fetcher` port 绑定 | Task 7 |
| `lib/messaging/sitemap-client.ts` | sidepanel 端 `fetchSitemapViaBackground` | Task 8 |
| `entrypoints/sidepanel/hooks/useGscRunner.ts` | `start` 返回 `SubmitResult[]` | Task 9 |
| `entrypoints/sidepanel/hooks/useBingRunner.ts` | 同上 | Task 9 |
| `entrypoints/sidepanel/hooks/useSubmitOrchestrator.ts` | 新 `run` 流程 + report state | Task 10 |
| `entrypoints/sidepanel/pages/SubmitPanel.tsx` | 删 Textarea + 加 sitemap 输入 + 报告区 | Task 11 |
| `tests/submitpanel.test.tsx` | 适配新 UI | Task 11 |
| `wxt.config.ts` | host_permissions 追加 `<all_urls>` | Task 12 |

---

## Task 1: sitemap XML 解析纯函数

**Files:**
- Create: `lib/sitemap/parse.ts`
- Test: `tests/sitemap-parse.test.ts`

**Interfaces:**
- Produces: `parseSitemapXml(text: string): ParsedSitemap`，其中 `ParsedSitemap = { kind: 'index' | 'urlset'; locs: string[] }`。`<loc>` 已 trim、已剥离 CDATA。空文档或无法识别根标签 → 抛 `Error`。

- [ ] **Step 1: 写失败测试**

`tests/sitemap-parse.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseSitemapXml } from '../lib/sitemap/parse';

describe('parseSitemapXml', () => {
  it('解析 urlset，抽取所有 <loc>', () => {
    const xml = `<?xml version="1.0"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/</loc></url>
        <url><loc>https://example.com/a</loc></url>
      </urlset>`;
    expect(parseSitemapXml(xml)).toEqual({
      kind: 'urlset',
      locs: ['https://example.com/', 'https://example.com/a'],
    });
  });

  it('解析 sitemapindex，kind=index', () => {
    const xml = `<?xml version="1.0"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/post-sitemap.xml</loc></sitemap>
      </sitemapindex>`;
    expect(parseSitemapXml(xml)).toEqual({
      kind: 'index',
      locs: ['https://example.com/post-sitemap.xml'],
    });
  });

  it('剥离 CDATA 与首尾空白', () => {
    const xml = `<urlset><url><loc>\n  <![CDATA[https://example.com/x]]>  </loc></url></urlset>`;
    expect(parseSitemapXml(xml).locs).toEqual(['https://example.com/x']);
  });

  it('空文档抛错', () => {
    expect(() => parseSitemapXml('   ')).toThrow();
  });

  it('无法识别根标签抛错', () => {
    expect(() => parseSitemapXml('<html><body>nope</body></html>')).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- tests/sitemap-parse.test.ts`
Expected: FAIL（`Cannot find module '../lib/sitemap/parse'`）

- [ ] **Step 3: 最小实现**

`lib/sitemap/parse.ts`:
```ts
/**
 * sitemap XML 解析（纯函数）。
 *
 * MV3 service worker 无 DOM API（DOMParser 不可用），用正则解析。
 * sitemap 结构规整：<sitemapindex> 含 <sitemap><loc>；<urlset> 含 <url><loc>。
 * <loc> 可能被 <![CDATA[…]]> 包裹，一并剥离。
 */
export type SitemapKind = 'index' | 'urlset';
export interface ParsedSitemap { kind: SitemapKind; locs: string[]; }

const LOC_RE = /<loc>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))\s*<\/loc>/gi;

export function parseSitemapXml(text: string): ParsedSitemap {
  const src = text.trim();
  if (!src) throw new Error('sitemap 为空');
  let kind: SitemapKind;
  if (/<sitemapindex[\s>]/i.test(src)) kind = 'index';
  else if (/<urlset[\s>]/i.test(src)) kind = 'urlset';
  else throw new Error('sitemap 根元素无法识别（非 sitemapindex/urlset）');

  const locs: string[] = [];
  let m: RegExpExecArray | null;
  LOC_RE.lastIndex = 0;
  while ((m = LOC_RE.exec(src)) !== null) {
    const v = (m[1] ?? m[2] ?? '').trim();
    if (v) locs.push(v);
  }
  return { kind, locs };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- tests/sitemap-parse.test.ts`
Expected: PASS（5 用例全过）

- [ ] **Step 5: 提交**

```bash
git add lib/sitemap/parse.ts tests/sitemap-parse.test.ts
git commit -m "feat(sitemap): parseSitemapXml 纯函数（正则解析 + CDATA 剥离）"
```

---

## Task 2: sitemap 递归抓取

**Files:**
- Create: `lib/sitemap/fetch.ts`
- Test: `tests/sitemap-fetch.test.ts`

**Interfaces:**
- Consumes: `parseSitemapXml` from Task 1。
- Produces: `fetchSitemapTree(entryUrl, opts?): Promise<FetchResult>`，`FetchResult = { urls: string[]; indexDepth: number; truncated: boolean }`。默认 `maxDepth=3, maxUrls=50000, perReqTimeoutMs=30000`。入口 URL 无效 / 入口 fetch 或解析失败 → 抛 `Error`。

- [ ] **Step 1: 写失败测试**

`tests/sitemap-fetch.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSitemapTree } from '../lib/sitemap/fetch';

function res(body: string, ok = true) {
  return { ok, status: 200, text: () => Promise.resolve(body) } as unknown as Response;
}

beforeEach(() => { vi.restoreAllMocks(); });

describe('fetchSitemapTree', () => {
  it('单层 urlset：返回同 host loc', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res(
      `<urlset><url><loc>https://example.com/a</loc></url><url><loc>https://example.com/b</loc></url></urlset>`,
    ));
    const r = await fetchSitemapTree('https://example.com/sitemap.xml');
    expect(r.urls).toEqual(['https://example.com/a', 'https://example.com/b']);
    expect(r.indexDepth).toBe(0);
    expect(r.truncated).toBe(false);
  });

  it('两层 index→urlset：递归合并子 sitemap', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(res(`<sitemapindex><sitemap><loc>https://example.com/post.xml</loc></sitemap></sitemapindex>`));
    fetchMock.mockResolvedValueOnce(res(`<urlset><url><loc>https://example.com/p1</loc></url></urlset>`));
    const r = await fetchSitemapTree('https://example.com/sitemap.xml');
    expect(r.urls).toEqual(['https://example.com/p1']);
    expect(r.indexDepth).toBe(1);
  });

  it('同 host 过滤：丢弃跨域 loc', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res(
      `<urlset>
        <url><loc>https://example.com/keep</loc></url>
        <url><loc>https://evil.com/drop</loc></url>
      </urlset>`,
    ));
    const r = await fetchSitemapTree('https://example.com/sitemap.xml');
    expect(r.urls).toEqual(['https://example.com/keep']);
  });

  it('maxUrls 截断：truncated=true', async () => {
    const urls = Array.from({ length: 5 }, (_, i) => `<url><loc>https://example.com/${i}</loc></url>`).join('');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res(`<urlset>${urls}</urlset>`));
    const r = await fetchSitemapTree('https://example.com/sitemap.xml', { maxUrls: 3 });
    expect(r.urls).toHaveLength(3);
    expect(r.truncated).toBe(true);
  });

  it('循环/重复 index 防失控（visited 去重）：同一子 sitemap 被多 parent 指向只 fetch 一次', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (u: string) => {
      if (u === 'https://example.com/sitemap.xml')
        return res(`<sitemapindex>
          <sitemap><loc>https://example.com/sub1.xml</loc></sitemap>
          <sitemap><loc>https://example.com/sub2.xml</loc></sitemap>
        </sitemapindex>`);
      if (u === 'https://example.com/sub1.xml')
        return res(`<sitemapindex><sitemap><loc>https://example.com/sub2.xml</loc></sitemap></sitemapindex>`);
      // sub2.xml 同时被 sitemap.xml 和 sub1.xml 指向
      return res(`<urlset><url><loc>https://example.com/leaf</loc></url></urlset>`);
    });
    const r = await fetchSitemapTree('https://example.com/sitemap.xml');
    expect(r.urls).toEqual(['https://example.com/leaf']);
    // visited 保证 sub2.xml 只被 fetch 一次
    const sub2Calls = fetchMock.mock.calls.filter((c) => c[0] === 'https://example.com/sub2.xml');
    expect(sub2Calls).toHaveLength(1);
  });

  it('入口 fetch 非 2xx 抛错', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('') } as unknown as Response);
    await expect(fetchSitemapTree('https://example.com/sitemap.xml')).rejects.toThrow();
  });

  it('入口 URL 无效抛错', async () => {
    await expect(fetchSitemapTree('not-a-url')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- tests/sitemap-fetch.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`lib/sitemap/fetch.ts`:
```ts
import { parseSitemapXml } from './parse';

export interface FetchOpts { maxDepth?: number; maxUrls?: number; perReqTimeoutMs?: number; }
export interface FetchResult { urls: string[]; indexDepth: number; truncated: boolean; }

function safeHost(url: string): string | null {
  try { return new URL(url).host; } catch { return null; }
}

function sameHost(loc: string, host: string): boolean {
  return safeHost(loc) === host;
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    if (!r.ok) throw new Error(`sitemap 请求失败: HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

/**
 * 递归抓取 sitemap 树。
 * - index：子 <loc> 入队（同 host + visited 去重）。
 * - urlset：<loc> 收入 urls（同 host + 去重）。
 * - 守卫：maxDepth（默认 3）、maxUrls（默认 50000）、单请求超时（默认 30s）。
 * - 入口（depth 0）fetch/解析失败直接抛；子 sitemap 失败则跳过（不中断整体）。
 */
export async function fetchSitemapTree(entryUrl: string, opts: FetchOpts = {}): Promise<FetchResult> {
  const maxDepth = opts.maxDepth ?? 3;
  const maxUrls = opts.maxUrls ?? 50000;
  const perReqTimeoutMs = opts.perReqTimeoutMs ?? 30000;

  const entryHost = safeHost(entryUrl);
  if (!entryHost) throw new Error('sitemap 入口 URL 无效');

  const visited = new Set<string>();
  const seen = new Set<string>();
  const urls: string[] = [];
  let indexDepth = 0;
  let truncated = false;
  const queue: Array<{ url: string; depth: number }> = [{ url: entryUrl, depth: 0 }];

  while (queue.length) {
    if (seen.size >= maxUrls) { truncated = true; break; }
    const { url, depth } = queue.shift()!;
    if (visited.has(url) || depth > maxDepth) continue;
    visited.add(url);

    let text: string;
    try { text = await fetchText(url, perReqTimeoutMs); }
    catch (e) { if (depth === 0) throw e; continue; }

    let parsed;
    try { parsed = parseSitemapXml(text); }
    catch { if (depth === 0) throw new Error('sitemap 解析失败'); continue; }

    if (parsed.kind === 'index') {
      indexDepth = Math.max(indexDepth, depth + 1);
      for (const loc of parsed.locs) {
        if (sameHost(loc, entryHost) && !visited.has(loc)) queue.push({ url: loc, depth: depth + 1 });
      }
    } else {
      for (const loc of parsed.locs) {
        if (!sameHost(loc, entryHost) || seen.has(loc)) continue;
        seen.add(loc);
        urls.push(loc);
        if (seen.size >= maxUrls) { truncated = true; break; }
      }
    }
  }
  return { urls, indexDepth, truncated };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- tests/sitemap-fetch.test.ts`
Expected: PASS（7 用例全过）

- [ ] **Step 5: 提交**

```bash
git add lib/sitemap/fetch.ts tests/sitemap-fetch.test.ts
git commit -m "feat(sitemap): fetchSitemapTree 递归抓取 + 同host过滤 + 守卫"
```

---

## Task 3: discovered 链接库存储

**Files:**
- Create: `lib/storage/discovered.ts`
- Test: `tests/discovered.test.ts`

**Interfaces:**
- Produces:
  - `interface DiscoveredLinks { domain: string; sitemapUrl: string; urls: string[]; updatedAt: number; }`
  - `getDiscovered(domain): Promise<DiscoveredLinks | null>`
  - `mergeDiscovered(domain, sitemapUrl, fetched: string[]): Promise<DiscoveredLinks>`（与已有 `urls` 取并集，更新 `sitemapUrl` / `updatedAt`）
  - storage key：`discovered:${domain}`

- [ ] **Step 1: 写失败测试**

`tests/discovered.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getDiscovered, mergeDiscovered } from '../lib/storage/discovered';

describe('discovered 存储', () => {
  it('merge 后可读回，且记录 sitemapUrl/updatedAt', async () => {
    const d = await mergeDiscovered('example.com', 'https://example.com/sitemap.xml', ['https://example.com/a', 'https://example.com/b']);
    expect(d.urls).toEqual(['https://example.com/a', 'https://example.com/b']);
    expect(d.sitemapUrl).toBe('https://example.com/sitemap.xml');
    expect(d.updatedAt).toBeGreaterThan(0);
    const got = await getDiscovered('example.com');
    expect(got?.urls).toEqual(['https://example.com/a', 'https://example.com/b']);
  });

  it('增量 merge 取并集、保序（旧在前）', async () => {
    await mergeDiscovered('example.com', 'https://example.com/sitemap.xml', ['https://example.com/a']);
    const d = await mergeDiscovered('example.com', 'https://example.com/sitemap.xml', ['https://example.com/a', 'https://example.com/b']);
    expect(d.urls).toEqual(['https://example.com/a', 'https://example.com/b']);
  });

  it('未写入时 getDiscovered 返回 null', async () => {
    expect(await getDiscovered('not-exist.com')).toBeNull();
  });

  it('domain 隔离：不同 domain 互不干扰', async () => {
    await mergeDiscovered('a.com', 'https://a.com/sitemap.xml', ['https://a.com/1']);
    await mergeDiscovered('b.com', 'https://b.com/sitemap.xml', ['https://b.com/1']);
    expect((await getDiscovered('a.com'))?.urls).toEqual(['https://a.com/1']);
    expect((await getDiscovered('b.com'))?.urls).toEqual(['https://b.com/1']);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- tests/discovered.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`lib/storage/discovered.ts`:
```ts
export interface DiscoveredLinks {
  domain: string;
  sitemapUrl: string;
  urls: string[];
  updatedAt: number;
}

const key = (domain: string) => `discovered:${domain}`;

export async function getDiscovered(domain: string): Promise<DiscoveredLinks | null> {
  const items = await chrome.storage.local.get(key(domain));
  return (items[key(domain)] as DiscoveredLinks | undefined) ?? null;
}

/**
 * 增量合并：fetched 与已有 urls 取并集（旧在前、保序），更新 sitemapUrl/updatedAt。
 */
export async function mergeDiscovered(
  domain: string,
  sitemapUrl: string,
  fetched: string[],
): Promise<DiscoveredLinks> {
  const cur = await getDiscovered(domain);
  const merged = new Set<string>(cur?.urls ?? []);
  for (const u of fetched) merged.add(u);
  const next: DiscoveredLinks = {
    domain,
    sitemapUrl,
    urls: [...merged],
    updatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [key(domain)]: next });
  return next;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- tests/discovered.test.ts`
Expected: PASS（4 用例）

- [ ] **Step 5: 提交**

```bash
git add lib/storage/discovered.ts tests/discovered.test.ts
git commit -m "feat(storage): discovered 链接库（按 domain 隔离 + 增量合并）"
```

---

## Task 4: submissions 提交记录存储

**Files:**
- Create: `lib/storage/submissions.ts`
- Test: `tests/submissions.test.ts`

**Interfaces:**
- Produces:
  - `type Platform = 'gsc' | 'bing';`
  - `interface SubmissionRecord { url: string; platform: Platform; status: 'ok' | 'skipped'; reason?: string; ts: number; batchId: string; }`
  - `getSubmissions(domain): Promise<SubmissionRecord[]>`
  - `isSubmittedOk(domain, url, platform): Promise<boolean>`
  - `appendSubmissions(domain, records: SubmissionRecord[]): Promise<void>`
  - storage key：`submissions:${domain}`

- [ ] **Step 1: 写失败测试**

`tests/submissions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getSubmissions, isSubmittedOk, appendSubmissions } from '../lib/storage/submissions';

describe('submissions 存储', () => {
  it('append 后可读回', async () => {
    await appendSubmissions('example.com', [
      { url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 1, batchId: 'b1' },
    ]);
    const all = await getSubmissions('example.com');
    expect(all).toHaveLength(1);
    expect(all[0].url).toBe('https://example.com/a');
  });

  it('isSubmittedOk：仅 status=ok 命中', async () => {
    await appendSubmissions('example.com', [
      { url: 'https://example.com/a', platform: 'gsc', status: 'skipped', reason: '配额', ts: 1, batchId: 'b1' },
    ]);
    expect(await isSubmittedOk('example.com', 'https://example.com/a', 'gsc')).toBe(false);
    await appendSubmissions('example.com', [
      { url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 2, batchId: 'b1' },
    ]);
    expect(await isSubmittedOk('example.com', 'https://example.com/a', 'gsc')).toBe(true);
  });

  it('按 platform 独立：gsc ok 不影响 bing 判定', async () => {
    await appendSubmissions('example.com', [
      { url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 1, batchId: 'b1' },
    ]);
    expect(await isSubmittedOk('example.com', 'https://example.com/a', 'gsc')).toBe(true);
    expect(await isSubmittedOk('example.com', 'https://example.com/a', 'bing')).toBe(false);
  });

  it('domain 隔离', async () => {
    await appendSubmissions('a.com', [{ url: 'https://a.com/1', platform: 'gsc', status: 'ok', ts: 1, batchId: 'b1' }]);
    expect(await isSubmittedOk('b.com', 'https://a.com/1', 'gsc')).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- tests/submissions.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`lib/storage/submissions.ts`:
```ts
export type Platform = 'gsc' | 'bing';

export interface SubmissionRecord {
  url: string;
  platform: Platform;
  status: 'ok' | 'skipped';
  reason?: string;
  ts: number;
  batchId: string;
}

const key = (domain: string) => `submissions:${domain}`;

export async function getSubmissions(domain: string): Promise<SubmissionRecord[]> {
  const items = await chrome.storage.local.get(key(domain));
  return (items[key(domain)] as SubmissionRecord[] | undefined) ?? [];
}

/**
 * 去重判定：是否存在 (url, platform) 且 status==='ok' 的记录。
 * skipped（配额/已索引/…）不计入黑名单——可重试。
 */
export async function isSubmittedOk(
  domain: string,
  url: string,
  platform: Platform,
): Promise<boolean> {
  const all = await getSubmissions(domain);
  return all.some((r) => r.url === url && r.platform === platform && r.status === 'ok');
}

/**
 * 追加提交记录（全量留作审计，不去重）。
 */
export async function appendSubmissions(domain: string, records: SubmissionRecord[]): Promise<void> {
  if (records.length === 0) return;
  const all = await getSubmissions(domain);
  all.push(...records);
  await chrome.storage.local.set({ [key(domain)]: all });
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- tests/submissions.test.ts`
Expected: PASS（4 用例）

- [ ] **Step 5: 提交**

```bash
git add lib/storage/submissions.ts tests/submissions.test.ts
git commit -m "feat(storage): submissions 提交记录（按 URL×平台去重 + 全量审计）"
```

---

## Task 5: 提交策略纯函数（reasons + pickRandom）

**Files:**
- Create: `lib/submit/reasons.ts`, `lib/submit/pick.ts`
- Test: `tests/submit-strategies.test.ts`

**Interfaces:**
- Produces:
  - `lib/submit/reasons.ts`：`SKIP_REASONS: readonly string[]`；`type Outcome = 'ok' | 'failed' | 'skipped'`；`classifyResult(r: { status: 'ok' | 'skipped'; reason?: string }): Outcome`
  - `lib/submit/pick.ts`：`pickRandom<T>(pool: T[], n: number): T[]`（Fisher-Yates；`n >= pool.length` 时返回全量副本）

- [ ] **Step 1: 写失败测试**

`tests/submit-strategies.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { classifyResult, SKIP_REASONS } from '../lib/submit/reasons';
import { pickRandom } from '../lib/submit/pick';

describe('classifyResult', () => {
  it('ok → ok', () => {
    expect(classifyResult({ status: 'ok' })).toBe('ok');
  });
  it('skipped + reason 命中 SKIP_REASONS → skipped', () => {
    for (const reason of SKIP_REASONS) {
      expect(classifyResult({ status: 'skipped', reason })).toBe('skipped');
    }
  });
  it('skipped + 动态 reason（Bing 诊断）→ failed（兜底）', () => {
    expect(classifyResult({ status: 'skipped', reason: '确认弹窗未出现(dialog=1,submit=0,deep=0)' })).toBe('failed');
  });
  it('skipped + 步骤异常文案 → failed', () => {
    expect(classifyResult({ status: 'skipped', reason: 'network error' })).toBe('failed');
  });
  it('skipped 无 reason → failed', () => {
    expect(classifyResult({ status: 'skipped' })).toBe('failed');
  });
});

describe('pickRandom', () => {
  it('n >= pool：返回全量副本', () => {
    const pool = [1, 2, 3];
    expect(pickRandom(pool, 5).sort()).toEqual([1, 2, 3]);
    expect(pickRandom(pool, 3).sort()).toEqual([1, 2, 3]);
  });
  it('n < pool：返回 n 个、均为 pool 元素、不重复', () => {
    const pool = [1, 2, 3, 4, 5];
    const out = pickRandom(pool, 3);
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
    for (const v of out) expect(pool).toContain(v);
  });
  it('空池返回空', () => {
    expect(pickRandom([], 10)).toEqual([]);
  });
  it('不修改原池', () => {
    const pool = [1, 2, 3, 4];
    const snap = [...pool];
    pickRandom(pool, 2);
    expect(pool).toEqual(snap);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- tests/submit-strategies.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`lib/submit/reasons.ts`:
```ts
/**
 * 报告分类常量与判定。
 *
 * 现有 SubmitResult.status 只有 'ok' | 'skipped'，无 'failed'。
 * skipped 里既有「预期跳过」（已索引/配额/…），也有「非预期失败」（检查未出现/步骤异常/Bing 诊断串）。
 * 采用**反向枚举**：reason 命中 SKIP_REASONS → 跳过；其余 skipped 兜底归失败，
 * 这样能覆盖 Bing 的动态诊断 reason 与 flow 的步骤异常文案，无需穷举失败集合。
 *
 * reason 文案须与 lib/gsc/flow.ts / lib/bing/flow.ts 产出严格一致。
 */
export const SKIP_REASONS = ['已索引', '不属于此域名', '配额', '未执行（批次终止）'] as const;

export type Outcome = 'ok' | 'failed' | 'skipped';

export function classifyResult(r: { status: 'ok' | 'skipped'; reason?: string }): Outcome {
  if (r.status === 'ok') return 'ok';
  if (r.reason && (SKIP_REASONS as readonly string[]).includes(r.reason)) return 'skipped';
  return 'failed';
}
```

`lib/submit/pick.ts`:
```ts
/**
 * Fisher-Yates 洗牌取前 n。n >= pool.length 时返回全量副本。
 * 随机源用 crypto.getRandomValues（SW 与 document 均可用）。
 */
export function pickRandom<T>(pool: T[], n: number): T[] {
  if (pool.length === 0 || n <= 0) return [];
  const arr = [...pool];
  const k = Math.min(n, arr.length);
  // 标准前向部分洗牌（partial Fisher-Yates）：i 从 0 到 k-1，每次从 [i, length)
  // 随机选一个换到位置 i。结果 arr[0..k] 是 k 个互不相同的随机元素、是 pool 子集；
  // O(k) 而非 O(pool.length)，且不修改原 pool。
  for (let i = 0; i < k; i++) {
    const j = i + randomInt(arr.length - i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, k);
}

function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % maxExclusive;
}
```

> `n >= pool.length` 时 `k = pool.length`，全洗牌后返回全量（顺序随机）；测试用 `.sort()` 比对，与实现无关。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- tests/submit-strategies.test.ts`
Expected: PASS（9 用例）

- [ ] **Step 5: 提交**

```bash
git add lib/submit/reasons.ts lib/submit/pick.ts tests/submit-strategies.test.ts
git commit -m "feat(submit): classifyResult（反向枚举分类）+ pickRandom（部分洗牌）"
```

---

## Task 6: sitemap messaging 类型 + protocol

**Files:**
- Modify: `lib/messaging/types.ts`（追加），`lib/messaging/protocol.ts`（追加）
- Test: 复用 Task 7/8 的集成测试覆盖（本任务无独立测试，纯类型+常量）

**Interfaces:**
- Produces:
  - `types.ts`：`SitemapFetchRequest { type: 'SITEMAP_FETCH'; sitemapUrl: string }`；`SitemapResult { type: 'SITEMAP_RESULT'; urls: string[]; stats: { indexDepth: number; truncated: boolean } }`；`SitemapError { type: 'SITEMAP_ERROR'; message: string }`；`SitemapRequest = SitemapFetchRequest`；`SitemapEvent = SitemapResult | SitemapError`
  - `protocol.ts`：`SITEMAP_PORT_NAME = 'sitemap-fetcher'`；`createSitemapPort(): chrome.runtime.Port`

- [ ] **Step 1: 追加类型**

在 `lib/messaging/types.ts` 末尾追加：
```ts
// ---------------------------------------------------------------------------
// sitemap 抓取协议（side panel UI ↔ background）。
// UI 经 sitemap-fetcher port 发 SITEMAP_FETCH；background 抓取解析后推 RESULT 或 ERROR。
// ---------------------------------------------------------------------------

/** 请求抓取并递归解析一个 sitemap 入口。 */
export interface SitemapFetchRequest {
  type: 'SITEMAP_FETCH';
  sitemapUrl: string;
}

/** 抓取成功：返回同 host 全量 <loc> 与统计。 */
export interface SitemapResult {
  type: 'SITEMAP_RESULT';
  urls: string[];
  stats: { indexDepth: number; truncated: boolean };
}

/** 抓取/解析失败：带可读 message 供 UI 日志展示。 */
export interface SitemapError {
  type: 'SITEMAP_ERROR';
  message: string;
}

export type SitemapRequest = SitemapFetchRequest;
export type SitemapEvent = SitemapResult | SitemapError;
```

- [ ] **Step 2: 追加 protocol**

在 `lib/messaging/protocol.ts` 末尾追加：
```ts
import type { SitemapRequest, SitemapEvent } from './types';

/** background 与 side panel 之间约定的 sitemap-fetcher port 名。 */
export const SITEMAP_PORT_NAME = 'sitemap-fetcher';

/**
 * 建立到 background 的 sitemap-fetcher port。
 * 调用方负责 onMessage.addListener 接收 SitemapEvent、postMessage 发送 SitemapRequest。
 */
export function createSitemapPort(): chrome.runtime.Port {
  return chrome.runtime.connect({ name: SITEMAP_PORT_NAME });
}
```

> 若 protocol.ts 当前未 import types，新增顶部 import；若已有则合并。

- [ ] **Step 3: 类型检查**

Run: `pnpm compile`
Expected: 无错误（仅新增类型与常量）

- [ ] **Step 4: 提交**

```bash
git add lib/messaging/types.ts lib/messaging/protocol.ts
git commit -m "feat(messaging): sitemap-fetcher port 类型与连接辅助"
```

---

## Task 7: sitemap handler 纯函数 + background 绑定

**Files:**
- Create: `lib/sitemap/handler.ts`
- Modify: `entrypoints/background.ts`（追加 port 分支）
- Test: `tests/sitemap-handler.test.ts`

**Interfaces:**
- Consumes: `fetchSitemapTree` from Task 2；`SitemapRequest/SitemapEvent` from Task 6。
- Produces: `handleSitemapRequest(msg: SitemapFetchRequest): Promise<SitemapEvent>`（try → `SitemapResult`，catch → `SitemapError`）。

- [ ] **Step 1: 写失败测试**

`tests/sitemap-handler.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSitemapRequest } from '../lib/sitemap/handler';

beforeEach(() => { vi.restoreAllMocks(); });

describe('handleSitemapRequest', () => {
  it('成功 → SITEMAP_RESULT', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve('<urlset><url><loc>https://example.com/a</loc></url></urlset>'),
    } as unknown as Response);
    const e = await handleSitemapRequest({ type: 'SITEMAP_FETCH', sitemapUrl: 'https://example.com/sitemap.xml' });
    expect(e.type).toBe('SITEMAP_RESULT');
    if (e.type === 'SITEMAP_RESULT') {
      expect(e.urls).toEqual(['https://example.com/a']);
      expect(e.stats.indexDepth).toBe(0);
    }
  });

  it('失败 → SITEMAP_ERROR（含 message）', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('') } as unknown as Response);
    const e = await handleSitemapRequest({ type: 'SITEMAP_FETCH', sitemapUrl: 'https://example.com/sitemap.xml' });
    expect(e.type).toBe('SITEMAP_ERROR');
    if (e.type === 'SITEMAP_ERROR') expect(e.message).toMatch(/404/);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- tests/sitemap-handler.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 handler**

`lib/sitemap/handler.ts`:
```ts
import { fetchSitemapTree } from './fetch';
import type { SitemapFetchRequest, SitemapEvent } from '@lib/messaging/types';

/**
 * 处理一条 SITEMAP_FETCH 请求 → 返回 RESULT 或 ERROR 事件。
 * 抽成纯函数便于单测；background 只做 port 绑定。
 */
export async function handleSitemapRequest(msg: SitemapFetchRequest): Promise<SitemapEvent> {
  try {
    const r = await fetchSitemapTree(msg.sitemapUrl);
    if (r.urls.length === 0) {
      return { type: 'SITEMAP_ERROR', message: 'sitemap 未包含任何同站链接' };
    }
    return {
      type: 'SITEMAP_RESULT',
      urls: r.urls,
      stats: { indexDepth: r.indexDepth, truncated: r.truncated },
    };
  } catch (e) {
    return { type: 'SITEMAP_ERROR', message: (e as Error).message ?? String(e) };
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- tests/sitemap-handler.test.ts`
Expected: PASS（2 用例）

- [ ] **Step 5: 在 background 绑定 port**

在 `entrypoints/background.ts`：
1. 顶部 import 区追加：
```ts
import { handleSitemapRequest } from '../lib/sitemap/handler';
import { SITEMAP_PORT_NAME } from '../lib/messaging/protocol';
import type { SitemapRequest, SitemapEvent } from '../lib/messaging/types';
```
2. 在 `chrome.runtime.onConnect.addListener` 的 if/else 链里（`BING_PORT_NAME` 分支之后）追加：
```ts
    } else if (port.name === SITEMAP_PORT_NAME) {
      port.onMessage.addListener(async (msg: SitemapRequest) => {
        if (msg.type !== 'SITEMAP_FETCH') return;
        const e: SitemapEvent = await handleSitemapRequest(msg);
        emit(port, e);
      });
```
> `emit` 已在 background.ts 定义（现有 GSC/Bing 复用），签名兼容 `SitemapEvent`（它是 postMessage 一个对象）。若 TS 报 `emit` 的联合类型不兼容，把 `emit` 形参类型扩为 `GscEvent | BingEvent | SitemapEvent`。

- [ ] **Step 6: 类型检查**

Run: `pnpm compile`
Expected: 无错误

- [ ] **Step 7: 提交**

```bash
git add lib/sitemap/handler.ts entrypoints/background.ts tests/sitemap-handler.test.ts
git commit -m "feat(background): sitemap-fetcher port（handler 纯函数 + port 绑定）"
```

---

## Task 8: sitemap-client（sidepanel 端封装）

**Files:**
- Create: `lib/messaging/sitemap-client.ts`
- Test: `tests/sitemap-client.test.ts`

**Interfaces:**
- Consumes: `createSitemapPort` from Task 6；`SitemapEvent` from Task 6。
- Produces: `fetchSitemapViaBackground(sitemapUrl: string): Promise<SitemapFetched>`，`SitemapFetched = { urls: string[]; stats: { indexDepth: number; truncated: boolean } }`。收到 `SITEMAP_ERROR` 或 port 断开 → reject `Error`。

- [ ] **Step 1: 写失败测试**

`tests/sitemap-client.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchSitemapViaBackground } from '../lib/messaging/sitemap-client';

function mockPort() {
  let msgCb: ((e: any) => void) | null = null;
  let discCb: (() => void) | null = null;
  const port = {
    postMessage: vi.fn(),
    onMessage: { addListener: (cb: (e: any) => void) => { msgCb = cb; } },
    onDisconnect: { addListener: (cb: () => void) => { discCb = cb; } },
    disconnect: vi.fn(),
  };
  (chrome as any).runtime.connect = vi.fn(() => port);
  return { port, emit: (e: any) => msgCb!(e), disconnect: () => discCb!() };
}

describe('fetchSitemapViaBackground', () => {
  it('发 SITEMAP_FETCH，收到 RESULT resolve urls/stats', async () => {
    const { port, emit } = mockPort();
    const p = fetchSitemapViaBackground('https://example.com/sitemap.xml');
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'SITEMAP_FETCH', sitemapUrl: 'https://example.com/sitemap.xml' });
    emit({ type: 'SITEMAP_RESULT', urls: ['https://example.com/a'], stats: { indexDepth: 1, truncated: false } });
    await expect(p).resolves.toEqual({ urls: ['https://example.com/a'], stats: { indexDepth: 1, truncated: false } });
  });

  it('收到 ERROR reject 且 disconnect port', async () => {
    const { port, emit } = mockPort();
    const p = fetchSitemapViaBackground('https://example.com/sitemap.xml');
    emit({ type: 'SITEMAP_ERROR', message: 'boom' });
    await expect(p).rejects.toThrow('boom');
    expect(port.disconnect).toHaveBeenCalled();
  });

  it('port 断开 reject', async () => {
    const { disconnect } = mockPort();
    const p = fetchSitemapViaBackground('https://example.com/sitemap.xml');
    disconnect();
    await expect(p).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- tests/sitemap-client.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`lib/messaging/sitemap-client.ts`:
```ts
import { createSitemapPort } from './protocol';
import type { SitemapEvent } from './types';

export interface SitemapFetched {
  urls: string[];
  stats: { indexDepth: number; truncated: boolean };
}

/**
 * 经 sitemap-fetcher port 请求 background 抓取并解析 sitemap。
 * 收到 RESULT resolve；收到 ERROR 或 port 意外断开 reject。任一结束都 disconnect 释放 port。
 */
export function fetchSitemapViaBackground(sitemapUrl: string): Promise<SitemapFetched> {
  return new Promise<SitemapFetched>((resolve, reject) => {
    const port = createSitemapPort();
    let settled = false;
    const done = (fn: () => void) => { if (settled) return; settled = true; try { port.disconnect(); } catch { /* ignore */ } fn(); };
    port.onMessage.addListener((e: SitemapEvent) => {
      if (e.type === 'SITEMAP_RESULT') done(() => resolve({ urls: e.urls, stats: e.stats }));
      else if (e.type === 'SITEMAP_ERROR') done(() => reject(new Error(e.message)));
    });
    port.onDisconnect.addListener(() => done(() => reject(new Error('sitemap 连接中断'))));
    port.postMessage({ type: 'SITEMAP_FETCH', sitemapUrl });
  });
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- tests/sitemap-client.test.ts`
Expected: PASS（3 用例）

- [ ] **Step 5: 提交**

```bash
git add lib/messaging/sitemap-client.ts tests/sitemap-client.test.ts
git commit -m "feat(messaging): fetchSitemapViaBackground sidepanel 端封装"
```

---

## Task 9: runner 改造（start 返回最终 results）

**Files:**
- Modify: `entrypoints/sidepanel/hooks/useGscRunner.ts`, `entrypoints/sidepanel/hooks/useBingRunner.ts`
- Test: `tests/useGscRunner.test.tsx`（新建）

**背景**：orchestrator 新流程要在每平台跑完后读「最终 results」落库。但 React state 更新异步，`await gsc.start()` resolve 时 `gsc.results` 未必刷新。改 `start` 返回 `Promise<SubmitResult[]>`：用 ref 缓存最后一次 `GSC_STATE` 的 results，`GSC_DONE` 时用它 resolve。

**Interfaces:**
- Produces: 两个 runner 的 `start(domain, urls): Promise<SubmitResult[]>`（原先 `Promise<void>`）。其余 `state / results / logs / cancel` 不变。
- 注意：现有 `tests/useSubmitOrchestrator.test.tsx` 的 mock runner `start: vi.fn()` 返回 `undefined`——Task 10 之前旧 orchestrator 仍 `await gsc.start()`（await undefined 无害），不破。Task 10 改 orchestrator 时会同步更新该 mock。

- [ ] **Step 1: 写 runner 测试（新）**

`tests/useGscRunner.test.tsx`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

function mockPort() {
  let msgCb: ((e: any) => void) | null = null;
  const port = {
    postMessage: vi.fn(),
    onMessage: { addListener: (cb: (e: any) => void) => { msgCb = cb; } },
    onDisconnect: { addListener: () => {} },
    disconnect: vi.fn(),
  };
  (chrome as any).runtime.connect = vi.fn(() => port);
  return { port, emit: (e: any) => msgCb!(e) };
}

describe('useGscRunner', () => {
  it('start 返回最终 results（DONE 时）', async () => {
    const { emit } = mockPort();
    const { useGscRunner } = await import('../entrypoints/sidepanel/hooks/useGscRunner');
    const { result } = renderHook(() => useGscRunner());
    let resolved: any;
    await act(async () => {
      const p = result.current.start('example.com', ['https://example.com/a']);
      resolved = undefined;
      emit({ type: 'GSC_STATE', state: 'running', total: 1, done: 1, currentUrl: 'https://example.com/a', results: [{ url: 'https://example.com/a', status: 'ok' }] });
      emit({ type: 'GSC_DONE', ok: 1, failed: 0, skipped: 0 });
      resolved = await p;
    });
    expect(resolved).toEqual([{ url: 'https://example.com/a', status: 'ok' }]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- tests/useGscRunner.test.tsx`
Expected: FAIL（start 当前 resolve void，断言 [] !== [{...}]）

- [ ] **Step 3: 改 useGscRunner**

`entrypoints/sidepanel/hooks/useGscRunner.ts`：
- 在 hook 内加 `const latestResults = useRef<SubmitResult[]>([]);`
- listener 里 `GSC_STATE` 分支追加 `latestResults.current = e.results;`
- `GSC_DONE` 分支改为 `doneRef.current?.(latestResults.current);`
- `start` 改为返回 `Promise<SubmitResult[]>`，并清空 `latestResults.current = [];`

完整 `start` 与 ref 声明：
```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { createGscPort } from '@lib/messaging/protocol';
import type { GscEvent, SubmitResult } from '@lib/messaging/types';
// ... RunnerState / IDLE / LogEntry 不变

export function useGscRunner() {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const doneRef = useRef<((results: SubmitResult[]) => void) | null>(null);
  const latestResults = useRef<SubmitResult[]>([]);
  const [state, setState] = useState<RunnerState>(IDLE);
  const [results, setResults] = useState<SubmitResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const port = createGscPort();
    portRef.current = port;
    port.onMessage.addListener((e: GscEvent) => {
      if (e.type === 'GSC_STATE') {
        setState({ running: e.state === 'running', total: e.total, done: e.done, currentUrl: e.currentUrl });
        setResults(e.results);
        latestResults.current = e.results;
      } else if (e.type === 'GSC_LOG') {
        setLogs((prev) => [...prev, { level: e.level, phase: e.phase, message: e.message, ts: Date.now() }]);
      } else if (e.type === 'GSC_DONE') {
        setState(IDLE);
        doneRef.current?.(latestResults.current);
        doneRef.current = null;
      }
    });
    return () => port.disconnect();
  }, []);

  const start = useCallback((domain: string, urls: string[]): Promise<SubmitResult[]> => {
    setLogs([]);
    setResults([]);
    latestResults.current = [];
    setState({ running: true, total: urls.length, done: 0 });
    portRef.current?.postMessage({ type: 'GSC_START', domain, urls });
    return new Promise<SubmitResult[]>((resolve) => { doneRef.current = resolve; });
  }, []);

  const cancel = useCallback(() => { portRef.current?.postMessage({ type: 'GSC_CANCEL' }); }, []);

  return { state, results, logs, start, cancel };
}
```

- [ ] **Step 4: 对称改 useBingRunner**

`entrypoints/sidepanel/hooks/useBingRunner.ts`：同样的三处改动（`latestResults` ref、`BING_STATE` 时更新、`BING_DONE` 时传入 resolve、`start` 返回 `Promise<SubmitResult[]>` 并清空 ref）。事件类型用 `BING_STATE/BING_LOG/BING_DONE`，postMessage 用 `BING_START/BING_CANCEL`。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm test -- tests/useGscRunner.test.tsx && pnpm test -- tests/useSubmitOrchestrator.test.tsx`
Expected: runner 测试 PASS；现有 orchestrator 测试仍 PASS（旧 orchestrator await undefined 无害）。

- [ ] **Step 6: 类型检查**

Run: `pnpm compile`
Expected: 无错误

- [ ] **Step 7: 提交**

```bash
git add entrypoints/sidepanel/hooks/useGscRunner.ts entrypoints/sidepanel/hooks/useBingRunner.ts tests/useGscRunner.test.tsx
git commit -m "refactor(runner): start 返回最终 SubmitResult[]（供 orchestrator 落库）"
```

---

## Task 10: useSubmitOrchestrator 新流程

**Files:**
- Modify: `entrypoints/sidepanel/hooks/useSubmitOrchestrator.ts`
- Modify: `tests/useSubmitOrchestrator.test.tsx`（重写为新流程）
- Test: 上一行同文件

**Interfaces:**
- Consumes: `fetchSitemapViaBackground`（Task 8）；`getDiscovered/mergeDiscovered`（Task 3）；`getSubmissions/appendSubmissions/Platform`（Task 4）；`pickRandom`（Task 5）。
- Produces（新 hook 返回）:
  - `run(platforms: Platforms, domain: string, sitemapUrl: string, deps?: { fetchSitemap?: typeof fetchSitemapViaBackground }): Promise<void>`
  - `report: ReportItem[]`，`ReportItem = { url: string; platform: Platform; status: 'ok'|'skipped'; reason?: string }`
  - `logs: LogEntry[]`（orchestrator 级系统日志：抓取/池/选中数）
  - 保留 `gsc / bing / active / cancel`
  - `clearReport(): void`

- [ ] **Step 1: 重写测试**

`tests/useSubmitOrchestrator.test.tsx`（整体替换）：
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { appendSubmissions } from '../lib/storage/submissions';

const gscStart = vi.fn();
const bingStart = vi.fn();
const fetchSitemap = vi.fn();
const baseRunner = (start: ReturnType<typeof vi.fn>) => ({
  start, cancel: vi.fn(),
  state: { running: false, total: 0, done: 0 },
  results: [], logs: [],
});

vi.mock('../entrypoints/sidepanel/hooks/useGscRunner', () => ({ useGscRunner: () => baseRunner(gscStart) }));
vi.mock('../entrypoints/sidepanel/hooks/useBingRunner', () => ({ useBingRunner: () => baseRunner(bingStart) }));

import { useSubmitOrchestrator } from '../entrypoints/sidepanel/hooks/useSubmitOrchestrator';

const SITEMAP = 'https://example.com/sitemap.xml';

beforeEach(() => {
  gscStart.mockReset(); bingStart.mockReset(); fetchSitemap.mockReset();
  fetchSitemap.mockResolvedValue({ urls: ['https://example.com/a', 'https://example.com/b'], stats: { indexDepth: 0, truncated: false } });
  gscStart.mockResolvedValue([{ url: 'https://example.com/a', status: 'ok' }, { url: 'https://example.com/b', status: 'ok' }]);
  bingStart.mockResolvedValue([{ url: 'https://example.com/a', status: 'ok' }, { url: 'https://example.com/b', status: 'ok' }]);
});

describe('useSubmitOrchestrator（sitemap 流程）', () => {
  it('fetch 失败时不调用 runner', async () => {
    fetchSitemap.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    expect(gscStart).not.toHaveBeenCalled();
  });

  it('候选池排除已 ok 的 URL', async () => {
    // 预置 a 在 gsc 已 ok
    await appendSubmissions('example.com', [{ url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 1, batchId: 'old' }]);
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    expect(gscStart).toHaveBeenCalledWith('example.com', ['https://example.com/b']);
  });

  it('不足 10 全选（这里 pool=2）', async () => {
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    const picked = gscStart.mock.calls[0][1] as string[];
    expect(picked).toHaveLength(2);
  });

  it('results 落库带 platform/batchId', async () => {
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: true }, 'example.com', SITEMAP, { fetchSitemap }); });
    const { getSubmissions } = await import('../lib/storage/submissions');
    const all = await getSubmissions('example.com');
    expect(all.filter(r => r.platform === 'gsc')).toHaveLength(2);
    expect(all.filter(r => r.platform === 'bing')).toHaveLength(2);
    const ids = new Set(all.map(r => r.batchId));
    expect(ids.size).toBe(1); // 同一批次同一 batchId
  });

  it('report 汇总 gsc+bing', async () => {
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: true }, 'example.com', SITEMAP, { fetchSitemap }); });
    await waitFor(() => expect(result.current.report).toHaveLength(4));
    expect(result.current.report.filter(r => r.status === 'ok')).toHaveLength(4);
  });

  it('池空时不提交', async () => {
    await appendSubmissions('example.com', [
      { url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 1, batchId: 'old' },
      { url: 'https://example.com/b', platform: 'gsc', status: 'ok', ts: 1, batchId: 'old' },
    ]);
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    expect(gscStart).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- tests/useSubmitOrchestrator.test.tsx`
Expected: FAIL（旧 run 签名 `(platforms, domain, urls)` 不匹配新 `(platforms, domain, sitemapUrl, deps)`）

- [ ] **Step 3: 实现**

`entrypoints/sidepanel/hooks/useSubmitOrchestrator.ts`（整体替换）：
```ts
import { useCallback, useRef, useState } from 'react';
import { useGscRunner } from './useGscRunner';
import { useBingRunner } from './useBingRunner';
import { fetchSitemapViaBackground, type SitemapFetched } from '@lib/messaging/sitemap-client';
import { getDiscovered, mergeDiscovered } from '@lib/storage/discovered';
import { getSubmissions, appendSubmissions, type Platform } from '@lib/storage/submissions';
import { pickRandom } from '@lib/submit/pick';
import type { SubmitResult } from '@lib/messaging/types';

export interface Platforms { gsc: boolean; bing: boolean; }

export interface ReportItem {
  url: string;
  platform: Platform;
  status: 'ok' | 'skipped';
  reason?: string;
}

export interface SysLogEntry { level: 'info' | 'warn' | 'error'; phase: string; message: string; ts: number; }

const BATCH_SIZE = 10;

export function useSubmitOrchestrator() {
  const gsc = useGscRunner();
  const bing = useBingRunner();
  const [active, setActive] = useState<'sitemap' | 'gsc' | 'bing' | null>(null);
  const [report, setReport] = useState<ReportItem[]>([]);
  const [logs, setLogs] = useState<SysLogEntry[]>([]);
  const runningRef = useRef(false);

  const pushLog = useCallback((level: SysLogEntry['level'], phase: string, message: string) => {
    setLogs((prev) => [...prev, { level, phase, message, ts: Date.now() }]);
  }, []);

  const run = useCallback(async (
    platforms: Platforms,
    domain: string,
    sitemapUrl: string,
    deps?: { fetchSitemap?: typeof fetchSitemapViaBackground },
  ) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setReport([]);
    const fetchSitemap = deps?.fetchSitemap ?? fetchSitemapViaBackground;

    try {
      // ① 抓 sitemap
      setActive('sitemap');
      pushLog('info', 'system', `抓取 sitemap: ${sitemapUrl}`);
      let fetched: SitemapFetched;
      try { fetched = await fetchSitemap(sitemapUrl); }
      catch (e) { pushLog('error', 'system', `sitemap 抓取失败: ${(e as Error).message}`); return; }
      pushLog('info', 'system', `发现 ${fetched.urls.length} 条链接（深度 ${fetched.stats.indexDepth}${fetched.stats.truncated ? '，已截断' : ''}）`);

      // ② 增量合并入库
      const discovered = await mergeDiscovered(domain, sitemapUrl, fetched.urls);

      // ③ 候选池：对所有勾选平台都未 ok 的 URL（批量 ok-set，避免逐条查）
      const selected: Platform[] = [];
      if (platforms.gsc) selected.push('gsc');
      if (platforms.bing) selected.push('bing');
      const subs = await getSubmissions(domain);
      const okSet = new Set(subs.filter((r) => r.status === 'ok').map((r) => `${r.platform}|${r.url}`));
      const pool = discovered.urls.filter((u) => selected.every((p) => !okSet.has(`${p}|${u}`)));

      // ④ 随机选 BATCH_SIZE
      const picked = pickRandom(pool, BATCH_SIZE);
      if (picked.length === 0) { pushLog('info', 'system', '无可提交链接，全部已提交'); return; }
      pushLog('info', 'system', `候选 ${pool.length}，本批选中 ${picked.length}`);

      // ⑤ 批次 id
      const batchId = crypto.randomUUID();
      const collected: ReportItem[] = [];

      // ⑥/⑦ 逐平台提交 + 落库
      if (platforms.gsc) {
        setActive('gsc');
        try {
          const results = await gsc.start(domain, picked);
          collected.push(...results.map((r) => ({ url: r.url, platform: 'gsc' as const, status: r.status, reason: r.reason })));
          await appendSubmissions(domain, results.map((r) => ({ url: r.url, platform: 'gsc' as const, status: r.status, reason: r.reason, ts: Date.now(), batchId })));
        } catch { /* 某平台失败不中断后续 */ }
      }
      if (platforms.bing) {
        setActive('bing');
        try {
          const results = await bing.start(domain, picked);
          collected.push(...results.map((r) => ({ url: r.url, platform: 'bing' as const, status: r.status, reason: r.reason })));
          await appendSubmissions(domain, results.map((r) => ({ url: r.url, platform: 'bing' as const, status: r.status, reason: r.reason, ts: Date.now(), batchId })));
        } catch { /* 同上 */ }
      }

      // ⑧ 报告
      setReport(collected);
      pushLog('info', 'system', `批次完成：${collected.length} 条结果`);
    } finally {
      setActive(null);
      runningRef.current = false;
    }
  }, [gsc.start, bing.start, pushLog]);

  const cancel = useCallback(() => { gsc.cancel(); bing.cancel(); }, [gsc.cancel, bing.cancel]);
  const clearReport = useCallback(() => setReport([]), []);

  return { gsc, bing, active, run, cancel, report, logs, clearReport };
}
```

> `getDiscovered` 未被直接使用（mergeDiscovered 返回值即最新库），可不入 import；上面 import 列表保留 `mergeDiscovered` 即可，删除未用的 `getDiscovered` 以过 `pnpm compile` 的 noUnusedLocals（若 tsconfig 开启）。实际实现时按编译器提示删未用 import。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- tests/useSubmitOrchestrator.test.tsx`
Expected: PASS（6 用例）

- [ ] **Step 5: 类型检查**

Run: `pnpm compile`
Expected: 无错误（清理未用 import）

- [ ] **Step 6: 提交**

```bash
git add entrypoints/sidepanel/hooks/useSubmitOrchestrator.ts tests/useSubmitOrchestrator.test.tsx
git commit -m "feat(submit): useSubmitOrchestrator 新流程（sitemap→去重→随机→落库→报告）"
```

---

## Task 11: SubmitPanel UI 改造

**Files:**
- Modify: `entrypoints/sidepanel/pages/SubmitPanel.tsx`
- Modify: `tests/submitpanel.test.tsx`（重写）

**Interfaces:**
- Consumes: `useSubmitOrchestrator`（Task 10，新签名）；`TextInput`（现有）；`normalizeOrigin` from `@lib/seo-files/url`（现有，用于拼默认 sitemapUrl）；`classifyResult` from `@lib/submit/reasons`（Task 5）。

- [ ] **Step 1: 重写组件测试**

`tests/submitpanel.test.tsx`（整体替换）：
```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const run = vi.fn();
vi.mock('../entrypoints/sidepanel/hooks/useSubmitOrchestrator', () => ({
  useSubmitOrchestrator: () => ({
    run,
    cancel: vi.fn(),
    active: null,
    report: [],
    logs: [],
    clearReport: vi.fn(),
    gsc: { state: { running: false, total: 0, done: 0 }, logs: [], results: [] },
    bing: { state: { running: false, total: 0, done: 0 }, logs: [], results: [] },
  }),
}));

import SubmitPanel from '../entrypoints/sidepanel/pages/SubmitPanel';

describe('SubmitPanel', () => {
  it('默认 sitemapUrl = origin + /sitemap.xml', () => {
    render(<SubmitPanel site={{ domain: 'example.com' }} onBack={() => {}} />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('https://example.com/sitemap.xml');
  });

  it('非法域名提交时显示错误且不调 run', () => {
    render(<SubmitPanel site={{ domain: 'not a domain' }} onBack={() => {}} />);
    fireEvent.click(screen.getByText('一次提交'));
    expect(screen.getByText(/请先选择或填写有效网站/)).toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
  });

  it('有效域名点击提交：用 sitemapUrl 调 run', () => {
    render(<SubmitPanel site={{ domain: 'example.com' }} onBack={() => {}} />);
    fireEvent.click(screen.getByText('一次提交'));
    expect(run).toHaveBeenCalledWith({ gsc: true, bing: true }, 'example.com', 'https://example.com/sitemap.xml');
  });

  it('手改 sitemapUrl 后用新值提交', () => {
    render(<SubmitPanel site={{ domain: 'example.com' }} onBack={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'https://example.com/sitemap-index.xml' } });
    fireEvent.click(screen.getByText('一次提交'));
    expect(run).toHaveBeenCalledWith({ gsc: true, bing: true }, 'example.com', 'https://example.com/sitemap-index.xml');
  });

  it('返回按钮触发 onBack', () => {
    const onBack = vi.fn();
    render(<SubmitPanel site={{ domain: 'example.com' }} onBack={onBack} />);
    fireEvent.click(screen.getByText('返回'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- tests/submitpanel.test.tsx`
Expected: FAIL（旧组件渲染 Textarea + 旧 run 签名）

- [ ] **Step 3: 重写 SubmitPanel**

`entrypoints/sidepanel/pages/SubmitPanel.tsx`（整体替换）：
```tsx
import { useEffect, useRef, useState } from 'react';
import Button from '../components/Button';
import TextInput from '../components/TextInput';
import LogPanel from '../components/LogPanel';
import PlatformChip from '../components/PlatformChip';
import { IconBack, GscMark, BingMark } from '../components/icons';
import { useSubmitOrchestrator, type ReportItem } from '../hooks/useSubmitOrchestrator';
import { isValidDomain } from '@lib/storage/projects';
import { normalizeOrigin } from '@lib/seo-files/url';
import { classifyResult } from '@lib/submit/reasons';
import type { Site } from '../hooks/useSite';

function defaultSitemapUrl(domain: string): string {
  try { return `${normalizeOrigin(domain)}/sitemap.xml`; } catch { return ''; }
}

export default function SubmitPanel({ site, onBack }: { site: Site; onBack: () => void }) {
  const orch = useSubmitOrchestrator();
  const [sitemapUrl, setSitemapUrl] = useState(() => defaultSitemapUrl(site.domain));
  const [gsc, setGsc] = useState(true);
  const [bing, setBing] = useState(true);
  const [error, setError] = useState('');
  const dirtyRef = useRef(false);

  // domain 变化时重置默认值（除非用户手改过）
  useEffect(() => {
    if (!dirtyRef.current) setSitemapUrl(defaultSitemapUrl(site.domain));
  }, [site.domain]);

  const busy = orch.gsc.state.running || orch.bing.state.running || orch.active === 'sitemap';
  const ready = sitemapUrl.trim().length > 0 && (gsc || bing) && !busy;

  function submit() {
    if (!isValidDomain(site.domain)) { setError('请先选择或填写有效网站（如 example.com）'); return; }
    setError('');
    void orch.run({ gsc, bing }, site.domain.trim(), sitemapUrl.trim());
  }

  const successes = orch.report.filter((r) => classifyResult(r) === 'ok');
  const failures = orch.report.filter((r) => classifyResult(r) === 'failed');
  const skips = orch.report.filter((r) => classifyResult(r) === 'skipped');

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <button type="button" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: 13, marginBottom: 12, padding: 0 }}>
        <IconBack size={14} /> 返回
      </button>
      <h2 style={{ fontSize: 17, marginBottom: 'var(--space-md)' }}>网站提交</h2>

      <label style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>目标平台</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-md)' }}>
        <PlatformChip label="GSC" icon={<GscMark />} checked={gsc} onToggle={() => setGsc((v) => !v)} />
        <PlatformChip label="Bing" icon={<BingMark />} checked={bing} onToggle={() => setBing((v) => !v)} />
      </div>

      <label style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>站点地图（sitemap.xml）</label>
      <TextInput value={sitemapUrl} placeholder="https://example.com/sitemap.xml" onChange={(e) => { dirtyRef.current = true; setSitemapUrl(e.target.value); }} />

      {error && <div style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 6 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-md)' }}>
        <Button onClick={submit} disabled={!ready} style={{ flex: 1 }}>{busy ? '提交中…' : '一次提交'}</Button>
        {busy && <Button variant="secondary" onClick={orch.cancel}>取消</Button>}
      </div>

      <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {orch.logs.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>▍系统</div>
            <LogPanel logs={orch.logs} />
          </div>
        )}
        {(gsc || orch.gsc.logs.length > 0) && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>▍GSC{orch.gsc.state.total > 0 ? `  ${orch.gsc.state.done}/${orch.gsc.state.total}` : ''}</div>
            <LogPanel logs={orch.gsc.logs} />
          </div>
        )}
        {(bing || orch.bing.logs.length > 0) && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>▍Bing{orch.bing.state.total > 0 ? `  ${orch.bing.state.done}/${orch.bing.state.total}` : ''}</div>
            <LogPanel logs={orch.bing.logs} />
          </div>
        )}
      </div>

      {orch.report.length > 0 && (
        <div style={{ marginTop: 'var(--space-md)', fontSize: 12, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            本批 {orch.report.length} 个 · 成功 {successes.length} · 失败 {failures.length} · 跳过 {skips.length}
          </div>
          {failures.length > 0 && (
            <div style={{ color: 'var(--color-error)', marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>失败：</div>
              {failures.map((r) => (<div key={`${r.platform}-${r.url}`}>· {r.url}（{r.platform}{r.reason ? `：${r.reason}` : ''}）</div>))}
            </div>
          )}
          {successes.length > 0 && (
            <div style={{ color: 'var(--color-muted)' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-ink)' }}>成功：</div>
              {successes.map((r) => (<div key={`${r.platform}-${r.url}`}>· {r.url}（{r.platform}）</div>))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

> `ReportItem` 已从 useSubmitOrchestrator 导出（Task 10）。若 tsconfig 不允许 type-only 混在默认 import 旁，用 `import type { ReportItem }`。这里实际只用于分类，未直接命名引用——可删去该 import（classifyResult 接收的结构子集即可），保留 `classifyResult`。实现时按编译器提示清理。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- tests/submitpanel.test.tsx`
Expected: PASS（5 用例）

- [ ] **Step 5: 类型检查 + 删 Textarea 引用确认无残留**

Run: `pnpm compile`
Expected: 无错误。`Textarea.tsx` 文件本身保留（其它地方未用即可；本任务不动它，避免无关删除）。

- [ ] **Step 6: 提交**

```bash
git add entrypoints/sidepanel/pages/SubmitPanel.tsx tests/submitpanel.test.tsx
git commit -m "feat(sidepanel): SubmitPanel 改造（sitemap 输入 + 批次报告）"
```

---

## Task 12: host_permissions + 全量回归

**Files:**
- Modify: `wxt.config.ts`

**目标**：放开跨域抓取权限，并跑全量测试 + 编译 + 构建确认无回归。

- [ ] **Step 1: 追加 host_permissions**

`wxt.config.ts` 第 11 行改为：
```ts
    host_permissions: ['https://search.google.com/*', 'https://www.bing.com/*', 'https://ahrefs.com/*', '<all_urls>'],
```

- [ ] **Step 2: 全量测试**

Run: `pnpm test`
Expected: 所有测试 PASS（含新增的 sitemap/storage/submit/runner/orchestrator/submitpanel + 现有全部）

- [ ] **Step 3: 类型检查**

Run: `pnpm compile`
Expected: 无错误

- [ ] **Step 4: 构建**

Run: `pnpm build`
Expected: 成功产出 `.output/chrome-mv3/`，manifest.json 的 host_permissions 含 `<all_urls>`。

- [ ] **Step 5: 提交**

```bash
git add wxt.config.ts
git commit -m "feat(permissions): host_permissions 追加 <all_urls>（抓取站点 sitemap 所需）"
```

- [ ] **Step 6: 手测清单（人工，构建产物加载到 Chrome）**

加载 `.output/chrome-mv3`，打开 sidepanel → 网站 → 选一个已登录 GSC/Bing 的站点 → 进入「网站提交」：
- [ ] sitemap 输入框默认显示 `https://<domain>/sitemap.xml`
- [ ] 点「一次提交」→ 系统日志显示「抓取 sitemap… → 发现 N 条链接」→「候选 K，本批选中 min(K,10)」
- [ ] GSC/Bing LogPanel 滚动显示逐条 inspect/submit 过程
- [ ] 结束后「本批 N · 成功 X · 失败 Y · 跳过 Z」+ 成功/失败 URL 列表
- [ ] 再次点「一次提交」：上一批 ok 的 URL 不再入选（候选数减少）
- [ ] sitemap URL 改成一个 sitemap-index 入口：系统日志显示 `深度 ≥ 1`
- [ ] 故意填错 sitemap URL：系统日志显示 error，不进入提交
