# 关键词工具扩展（Google Trends + 快捷搜索）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「关键词工具」板块顶部引入公共关键词输入，新增 Google Trends 趋势查询与 Google/Bing 快捷搜索两张工具卡片，并把现有 Ahrefs 工具改造为复用公共关键词、带品牌 logo 的卡片之一。

**Architecture:** `KeywordTools` 持有板块级 `keyword` state（持久化到 `chrome.storage.local`），向下传给三张 `ToolPanel` 卡片（Ahrefs / Google Trends / 快捷搜索）。每张卡片带品牌 logo + 标题 + 各自特有的选项控件，点击执行按钮时调用各自的 url builder 拼 URL 并 `chrome.tabs.create({ url })` 打开新标签。新增 `lib/trends/url.ts`、`lib/quicksearch/url.ts`、`components/brand-logos.tsx`、`components/ToolPanel.tsx`；**不触碰** CDP / messaging / background。

**Tech Stack:** React 19 + TypeScript + WXT + Vitest + @testing-library/react；`chrome.storage.local` / `chrome.tabs` API；内联样式 + CSS 变量。

## Global Constraints

- 关键词是公共输入：`KeywordTools` 板块级 state，持久化键 `kw-tools:keyword`，以 prop 下传给三张卡片，卡片自身不再有关键词输入。
- 三个工具均走纯 URL `chrome.tabs.create({ url })`，不引入 CDP / messaging / background 任何改动。
- Trends `geo` 用**大写**（`Worldwide` / `US` / `GB`…）；Ahrefs `country` 用**小写**（`us` / `gb`…）——两者不同，勿混。
- Trends `date` 固定三档：`7天=now 7-d`、`30天=today 1-m`、`1年=today 1-y`。
- 快捷搜索 URL：`https://www.google.com/search?q=`、`https://cn.bing.com/search?q=`（**不加** `gws_rd=ssl`）。
- 预期**不改** `wxt.config.ts` 的 `host_permissions`（`tabs.create` 打开任意 URL 不需要 host 权限）；Task 9 验证。
- 源码 import 用路径别名（`@lib/*`、`@components/*`）；测试 import 用相对路径（`../lib/...`、`../entrypoints/...`）——与现有代码一致。
- 命令：单测 `pnpm test <file>`，类型检查 `pnpm compile`，构建 `pnpm build`。
- `chrome` 已在 `tests/setup.ts` 全局 mock（`storage.local` 内存实现含 `onChanged`，`tabs.create` 返回 `{id:1}`），每测前 storage 自动重置。

## 文件结构

| 文件 | 动作 | 责任 |
|---|---|---|
| `lib/trends/url.ts` | 新增 | `buildTrendsUrl` + `TRENDS_DATE_RANGES` / `TRENDS_GEOS` 常量 + 校验 |
| `lib/quicksearch/url.ts` | 新增 | `buildGoogleSearchUrl` / `buildBingSearchUrl` + 校验 |
| `entrypoints/sidepanel/components/brand-logos.tsx` | 新增 | `AhrefsLogo` / `GoogleTrendsLogo` / `GoogleLogo` / `BingLogo` 内联 SVG |
| `entrypoints/sidepanel/components/ToolPanel.tsx` | 新增 | 共享卡片壳：`logo` / `title` / `subtitle?` / `children` |
| `entrypoints/sidepanel/pages/GoogleTrendsTool.tsx` | 新增 | 趋势工具卡片 |
| `entrypoints/sidepanel/pages/QuickSearchTool.tsx` | 新增 | 快捷搜索卡片（Google + Bing 两按钮） |
| `entrypoints/sidepanel/pages/AhrefsTool.tsx` | 改造 | 接收 `keyword` prop、用 `ToolPanel` + logo、去掉内部关键词输入 |
| `entrypoints/sidepanel/pages/KeywordTools.tsx` | 改造 | 持有公共 `keyword` + 持久化、渲染公共输入与三张卡片 |
| `tests/trends-url.test.ts` | 新增 | trends url builder 单测 |
| `tests/quicksearch-url.test.ts` | 新增 | quicksearch url builder 单测 |
| `tests/brand-logos.test.tsx` | 新增 | logo 组件渲染测试 |
| `tests/toolpanel.test.tsx` | 新增 | ToolPanel 渲染测试 |
| `tests/google-trends-tool.test.tsx` | 新增 | 趋势卡片渲染 / disabled / 点击 |
| `tests/quick-search-tool.test.tsx` | 新增 | 快捷搜索卡片渲染 / disabled / 点击 |
| `tests/ahrefs-tool.test.tsx` | 新增 | Ahrefs 卡片渲染 / disabled / 点击（覆盖改造后行为） |
| `tests/keywordtools.test.tsx` | 修改 | 断言三张卡片标题（保留原有 `关键词工具` / `如 apple` 断言） |

任务依赖：Task 1–4 互相独立；Task 5–7 依赖 1–4；Task 8 依赖 5–7；Task 9 全局验证。

---

### Task 1: Google Trends URL builder

**Files:**
- Create: `lib/trends/url.ts`
- Test: `tests/trends-url.test.ts`

**Interfaces:**
- Produces: `TRENDS_DATE_RANGES: ReadonlyArray<{ value: string; label: string }>`（value 即 `date` 段值）、`TRENDS_GEOS: ReadonlyArray<{ value: string; label: string }>`（value 即 `geo` 段值，`Worldwide` 或大写国家码）、`buildTrendsUrl(keyword: string, compare: string, date: string, geo: string): string`。空主词抛 `Error('keyword required')`。

- [ ] **Step 1: 写失败测试**

创建 `tests/trends-url.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { buildTrendsUrl, TRENDS_DATE_RANGES, TRENDS_GEOS } from '../lib/trends/url';

describe('trends url', () => {
  it('30天 + 全球 + 对比词 gpts', () => {
    expect(buildTrendsUrl('apple', 'gpts', 'today 1-m', 'Worldwide'))
      .toBe('https://trends.google.com/explore?q=apple%2Cgpts&date=today%201-m&geo=Worldwide');
  });
  it('1年 + 美国 + 无对比词（不带逗号）', () => {
    expect(buildTrendsUrl('apple', '', 'today 1-y', 'US'))
      .toBe('https://trends.google.com/explore?q=apple&date=today%201-y&geo=US');
  });
  it('7天 date 含空格需编码', () => {
    expect(buildTrendsUrl('apple', 'gpts', 'now 7-d', 'US'))
      .toBe('https://trends.google.com/explore?q=apple%2Cgpts&date=now%207-d&geo=US');
  });
  it('主词含空格需编码', () => {
    expect(buildTrendsUrl('best laptop', 'gpts', 'today 1-m', 'Worldwide'))
      .toContain('q=best%20laptop%2Cgpts');
  });
  it('空主词抛错', () => {
    expect(() => buildTrendsUrl('  ', 'gpts', 'today 1-m', 'Worldwide')).toThrow();
  });
  it('日期常量含三档', () => {
    const values = TRENDS_DATE_RANGES.map((d) => d.value);
    expect(values).toEqual(['now 7-d', 'today 1-m', 'today 1-y']);
  });
  it('地区常量默认全球 + 主流国家（大写）', () => {
    expect(TRENDS_GEOS[0].value).toBe('Worldwide');
    expect(TRENDS_GEOS.some((g) => g.value === 'US')).toBe(true);
    expect(TRENDS_GEOS.some((g) => g.value === 'JP')).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test tests/trends-url.test.ts`
Expected: FAIL（`Cannot find module '../lib/trends/url'`）

- [ ] **Step 3: 实现**

创建 `lib/trends/url.ts`：

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test tests/trends-url.test.ts`
Expected: PASS（7 passed）

- [ ] **Step 5: 提交**

```bash
git add lib/trends/url.ts tests/trends-url.test.ts
git commit -m "feat(lib): Google Trends url builder"
```

---

### Task 2: 快捷搜索 URL builder

**Files:**
- Create: `lib/quicksearch/url.ts`
- Test: `tests/quicksearch-url.test.ts`

**Interfaces:**
- Produces: `buildGoogleSearchUrl(keyword: string): string`、`buildBingSearchUrl(keyword: string): string`。空关键词抛 `Error('keyword required')`。

- [ ] **Step 1: 写失败测试**

创建 `tests/quicksearch-url.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { buildGoogleSearchUrl, buildBingSearchUrl } from '../lib/quicksearch/url';

describe('quicksearch url', () => {
  it('Google 结果页', () => {
    expect(buildGoogleSearchUrl('apple')).toBe('https://www.google.com/search?q=apple');
  });
  it('Bing 结果页（cn.bing.com）', () => {
    expect(buildBingSearchUrl('apple')).toBe('https://cn.bing.com/search?q=apple');
  });
  it('关键词含空格需编码', () => {
    expect(buildGoogleSearchUrl('best laptop')).toBe('https://www.google.com/search?q=best%20laptop');
  });
  it('空关键词抛错', () => {
    expect(() => buildGoogleSearchUrl('')).toThrow();
    expect(() => buildBingSearchUrl('   ')).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test tests/quicksearch-url.test.ts`
Expected: FAIL（`Cannot find module '../lib/quicksearch/url'`）

- [ ] **Step 3: 实现**

创建 `lib/quicksearch/url.ts`：

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test tests/quicksearch-url.test.ts`
Expected: PASS（4 passed）

- [ ] **Step 5: 提交**

```bash
git add lib/quicksearch/url.ts tests/quicksearch-url.test.ts
git commit -m "feat(lib): quicksearch url builder"
```

---

### Task 3: 品牌 logo 组件

**Files:**
- Create: `entrypoints/sidepanel/components/brand-logos.tsx`
- Test: `tests/brand-logos.test.tsx`

**Interfaces:**
- Produces: `AhrefsLogo` / `GoogleTrendsLogo` / `GoogleLogo` / `BingLogo`，均 `(props: { size?: number }) => JSX.Element`，渲染一个 `<svg>`。

**设计说明（实现者必读）：** 这些是**品牌色徽标**——用各品牌主色 + 标志性图形/字母构成，完整可渲染、可识别（配合卡片标题）。若后续要替换为像素级精确的官方 logo 轮廓，只需替换组件内部 `<svg>` 子元素，组件签名（`{ size }`）不变。

- [ ] **Step 1: 写失败测试**

创建 `tests/brand-logos.test.tsx`：

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AhrefsLogo, GoogleTrendsLogo, GoogleLogo, BingLogo } from '../entrypoints/sidepanel/components/brand-logos';

describe('brand-logos', () => {
  const all = { AhrefsLogo, GoogleTrendsLogo, GoogleLogo, BingLogo };
  for (const [name, Comp] of Object.entries(all)) {
    it(`${name} 渲染一个 svg`, () => {
      const { container } = render(<Comp />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  }
  it('接受 size', () => {
    const { container } = render(<GoogleLogo size={24} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('24');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test tests/brand-logos.test.tsx`
Expected: FAIL（`Cannot find module '../entrypoints/sidepanel/components/brand-logos'`）

- [ ] **Step 3: 实现**

创建 `entrypoints/sidepanel/components/brand-logos.tsx`：

```tsx
interface LogoProps { size?: number; }

/** Google — 四色圆点（蓝/红/黄/绿），品牌强识别。 */
export function GoogleLogo({ size = 16 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3.4" fill="#4285F4" />
      <circle cx="16" cy="8" r="3.4" fill="#EA4335" />
      <circle cx="8" cy="16" r="3.4" fill="#FBBC05" />
      <circle cx="16" cy="16" r="3.4" fill="#34A853" />
    </svg>
  );
}

/** Bing — 青绿底 + 白色 b。 */
export function BingLogo({ size = 16 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#008373" />
      <text x="12" y="17" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="14" fontWeight="700" fill="#fff">b</text>
    </svg>
  );
}

/** Ahrefs — 橙底 + 白色 A。 */
export function AhrefsLogo({ size = 16 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#ff7300" />
      <text x="12" y="17" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="14" fontWeight="700" fill="#fff">A</text>
    </svg>
  );
}

/** Google Trends — Google 蓝底 + 白色上升趋势线。 */
export function GoogleTrendsLogo({ size = 16 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#4285F4" />
      <polyline points="5,15 10,10 13,13 19,6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15,6 19,6 19,10" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test tests/brand-logos.test.tsx`
Expected: PASS（5 passed）

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/components/brand-logos.tsx tests/brand-logos.test.tsx
git commit -m "feat(sidepanel): 品牌 logo 组件"
```

---

### Task 4: ToolPanel 共享卡片壳

**Files:**
- Create: `entrypoints/sidepanel/components/ToolPanel.tsx`
- Test: `tests/toolpanel.test.tsx`

**Interfaces:**
- Produces: `default export ToolPanel`，props `{ logo: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }`。渲染带边框的面板：header 行（logo + title + 可选 subtitle），下方 children。title / subtitle 为独立文本节点（便于精确断言）。

- [ ] **Step 1: 写失败测试**

创建 `tests/toolpanel.test.tsx`：

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ToolPanel from '../entrypoints/sidepanel/components/ToolPanel';

describe('ToolPanel', () => {
  it('渲染 logo / title / subtitle / children', () => {
    render(
      <ToolPanel logo={<span data-testid="lg" />} title="Ahrefs" subtitle="关键词难度查询">
        <span>表单区</span>
      </ToolPanel>,
    );
    expect(screen.getByTestId('lg')).toBeInTheDocument();
    expect(screen.getByText('Ahrefs')).toBeInTheDocument();
    expect(screen.getByText('关键词难度查询')).toBeInTheDocument();
    expect(screen.getByText('表单区')).toBeInTheDocument();
  });
  it('subtitle 可选', () => {
    render(<ToolPanel logo={<span />} title="T"><i>x</i></ToolPanel>);
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test tests/toolpanel.test.tsx`
Expected: FAIL（`Cannot find module '../entrypoints/sidepanel/components/ToolPanel'`）

- [ ] **Step 3: 实现**

创建 `entrypoints/sidepanel/components/ToolPanel.tsx`：

```tsx
interface ToolPanelProps {
  logo: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/** 工具卡片壳：统一 logo + 标题 header，下方放各工具特有的表单控件。 */
export default function ToolPanel({ logo, title, subtitle, children }: ToolPanelProps) {
  return (
    <section
      style={{
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-canvas)',
        padding: 'var(--space-sm) var(--space-md)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-sm)' }}>
        <span style={{ display: 'inline-flex', lineHeight: 0 }}>{logo}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>{title}</span>
        {subtitle && <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test tests/toolpanel.test.tsx`
Expected: PASS（2 passed）

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/components/ToolPanel.tsx tests/toolpanel.test.tsx
git commit -m "feat(sidepanel): ToolPanel 卡片壳"
```

---

### Task 5: Google Trends 工具卡片

**Files:**
- Create: `entrypoints/sidepanel/pages/GoogleTrendsTool.tsx`
- Test: `tests/google-trends-tool.test.tsx`

**Interfaces:**
- Consumes: `ToolPanel`（Task 4）、`GoogleTrendsLogo`（Task 3）、`TRENDS_DATE_RANGES` / `TRENDS_GEOS` / `buildTrendsUrl`（Task 1）；现有组件 `Select`（`{ options: {value,label}[]; value; onChange(e) }`）、`Combobox`（`{ value; options: string[]; onChange(v: string); placeholder? }`）、`Button`（`{ onClick; disabled; style; variant? }`）。
- Produces: `default export GoogleTrendsTool`，props `{ keyword: string }`。记忆上次选择到 `chrome.storage.local['kw-tools:trends'] = { date, compare, geo }`。

- [ ] **Step 1: 写失败测试**

创建 `tests/google-trends-tool.test.tsx`：

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GoogleTrendsTool from '../entrypoints/sidepanel/pages/GoogleTrendsTool';

afterEach(() => { vi.restoreAllMocks(); });

describe('GoogleTrendsTool', () => {
  it('渲染标题与搜索按钮，关键词非空时可用', () => {
    render(<GoogleTrendsTool keyword="apple" />);
    expect(screen.getByText('Google Trends')).toBeInTheDocument();
    expect(screen.getByText('谷歌趋势')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '搜索' })).toBeEnabled();
  });
  it('关键词为空时按钮禁用', () => {
    render(<GoogleTrendsTool keyword="" />);
    expect(screen.getByRole('button', { name: '搜索' })).toBeDisabled();
  });
  it('点击搜索以新标签打开趋势链接，含主词 apple', () => {
    const spy = vi.spyOn(chrome.tabs, 'create');
    render(<GoogleTrendsTool keyword="apple" />);
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(spy).toHaveBeenCalledTimes(1);
    const url = spy.mock.calls[0][0].url as string;
    expect(url.startsWith('https://trends.google.com/explore')).toBe(true);
    expect(url).toContain('q=apple');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test tests/google-trends-tool.test.tsx`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

创建 `entrypoints/sidepanel/pages/GoogleTrendsTool.tsx`：

```tsx
import { useEffect, useState } from 'react';
import Button from '../components/Button';
import Select from '../components/Select';
import Combobox from '../components/Combobox';
import ToolPanel from '../components/ToolPanel';
import { GoogleTrendsLogo } from '../components/brand-logos';
import { TRENDS_DATE_RANGES, TRENDS_GEOS, buildTrendsUrl } from '@lib/trends/url';

const STORAGE_KEY = 'kw-tools:trends';
const COMPARE_PRESETS = ['gpts', 'chatgpt', 'ai', 'ai tools'];

interface Props { keyword: string; }
interface Last { date: string; compare: string; geo: string; }

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 };
const fieldStyle: React.CSSProperties = { marginTop: 'var(--space-sm)' };

export default function GoogleTrendsTool({ keyword }: Props) {
  const [date, setDate] = useState<string>('today 1-m');
  const [compare, setCompare] = useState<string>('gpts');
  const [geo, setGeo] = useState<string>('Worldwide');

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (items) => {
      const last = items[STORAGE_KEY] as Partial<Last> | undefined;
      if (last) {
        if (last.date) setDate(last.date);
        if (typeof last.compare === 'string') setCompare(last.compare);
        if (last.geo) setGeo(last.geo);
      }
    });
  }, []);

  function persist(patch: Partial<Last>) {
    chrome.storage.local.set({ [STORAGE_KEY]: { date, compare, geo, ...patch } });
  }

  function open() {
    const url = buildTrendsUrl(keyword, compare, date, geo);
    chrome.storage.local.set({ [STORAGE_KEY]: { date, compare, geo } });
    chrome.tabs.create({ url });
  }

  return (
    <ToolPanel logo={<GoogleTrendsLogo size={18} />} title="Google Trends" subtitle="谷歌趋势">
      <label style={labelStyle}>天数</label>
      <Select
        value={date}
        options={TRENDS_DATE_RANGES.map((d) => ({ value: d.value, label: d.label }))}
        onChange={(e) => { setDate(e.target.value); persist({ date: e.target.value }); }}
      />
      <label style={{ ...labelStyle, ...fieldStyle }}>对比词</label>
      <Combobox
        value={compare}
        options={COMPARE_PRESETS}
        placeholder="如 gpts，可留空"
        onChange={(v) => { setCompare(v); persist({ compare: v }); }}
      />
      <label style={{ ...labelStyle, ...fieldStyle }}>地区</label>
      <Select
        value={geo}
        options={TRENDS_GEOS.map((g) => ({ value: g.value, label: g.label }))}
        onChange={(e) => { setGeo(e.target.value); persist({ geo: e.target.value }); }}
      />
      <Button onClick={open} disabled={!keyword.trim()} style={{ marginTop: 'var(--space-md)', width: '100%' }}>
        搜索
      </Button>
    </ToolPanel>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test tests/google-trends-tool.test.tsx`
Expected: PASS（3 passed）

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/pages/GoogleTrendsTool.tsx tests/google-trends-tool.test.tsx
git commit -m "feat(sidepanel): Google Trends 工具卡片"
```

---

### Task 6: 快捷搜索工具卡片

**Files:**
- Create: `entrypoints/sidepanel/pages/QuickSearchTool.tsx`
- Test: `tests/quick-search-tool.test.tsx`

**Interfaces:**
- Consumes: `ToolPanel`（Task 4）、`GoogleLogo` / `BingLogo`（Task 3）、`buildGoogleSearchUrl` / `buildBingSearchUrl`（Task 2）；现有 `Button`。
- Produces: `default export QuickSearchTool`，props `{ keyword: string }`。无特有选项、不记忆。

- [ ] **Step 1: 写失败测试**

创建 `tests/quick-search-tool.test.tsx`：

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuickSearchTool from '../entrypoints/sidepanel/pages/QuickSearchTool';

afterEach(() => { vi.restoreAllMocks(); });

describe('QuickSearchTool', () => {
  it('渲染 Google / Bing 两个按钮，关键词非空时可用', () => {
    render(<QuickSearchTool keyword="apple" />);
    expect(screen.getByRole('button', { name: '用 Google 搜' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '用 Bing 搜' })).toBeEnabled();
  });
  it('关键词为空时两按钮均禁用', () => {
    render(<QuickSearchTool keyword="" />);
    expect(screen.getByRole('button', { name: '用 Google 搜' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '用 Bing 搜' })).toBeDisabled();
  });
  it('点击 Google / Bing 分别打开对应结果页', () => {
    const spy = vi.spyOn(chrome.tabs, 'create');
    render(<QuickSearchTool keyword="apple" />);
    fireEvent.click(screen.getByRole('button', { name: '用 Google 搜' }));
    fireEvent.click(screen.getByRole('button', { name: '用 Bing 搜' }));
    expect(spy).toHaveBeenCalledTimes(2);
    expect((spy.mock.calls[0][0].url as string).startsWith('https://www.google.com/search?q=apple')).toBe(true);
    expect((spy.mock.calls[1][0].url as string).startsWith('https://cn.bing.com/search?q=apple')).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test tests/quick-search-tool.test.tsx`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

创建 `entrypoints/sidepanel/pages/QuickSearchTool.tsx`：

```tsx
import Button from '../components/Button';
import ToolPanel from '../components/ToolPanel';
import { GoogleLogo, BingLogo } from '../components/brand-logos';
import { buildGoogleSearchUrl, buildBingSearchUrl } from '@lib/quicksearch/url';

interface Props { keyword: string; }

export default function QuickSearchTool({ keyword }: Props) {
  const disabled = !keyword.trim();
  return (
    <ToolPanel logo={<GoogleLogo size={18} />} title="快捷搜索">
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          variant="secondary"
          onClick={() => chrome.tabs.create({ url: buildGoogleSearchUrl(keyword) })}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          用 Google 搜
        </Button>
        <Button
          variant="secondary"
          onClick={() => chrome.tabs.create({ url: buildBingSearchUrl(keyword) })}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          用 Bing 搜
        </Button>
      </div>
    </ToolPanel>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test tests/quick-search-tool.test.tsx`
Expected: PASS（3 passed）

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/pages/QuickSearchTool.tsx tests/quick-search-tool.test.tsx
git commit -m "feat(sidepanel): 快捷搜索工具卡片"
```

---

### Task 7: 改造 AhrefsTool（复用公共关键词 + ToolPanel + logo）

**Files:**
- Modify: `entrypoints/sidepanel/pages/AhrefsTool.tsx`
- Test: `tests/ahrefs-tool.test.tsx`（新增）

**Interfaces:**
- Consumes: `ToolPanel`（Task 4）、`AhrefsLogo`（Task 3）；现有 `Select` / `TextInput` / `Button`；现有 `COUNTRIES` / `buildAhrefsUrl` / `isValidCountryCode` from `@lib/ahrefs/url`。
- Produces: `default export AhrefsTool`，props `{ keyword: string }`（**不再是自有关键词输入**）。国家下拉（含自定义两位代码）保留；记忆到 `chrome.storage.local['ahrefs:last'] = { country }`（去掉旧的 keyword 字段）。

- [ ] **Step 1: 写失败测试**

创建 `tests/ahrefs-tool.test.tsx`：

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AhrefsTool from '../entrypoints/sidepanel/pages/AhrefsTool';

afterEach(() => { vi.restoreAllMocks(); });

describe('AhrefsTool', () => {
  it('渲染标题与副标题，关键词非空时按钮可用', () => {
    render(<AhrefsTool keyword="apple" />);
    expect(screen.getByText('Ahrefs')).toBeInTheDocument();
    expect(screen.getByText('关键词难度查询')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开查询' })).toBeEnabled();
  });
  it('关键词为空时按钮禁用', () => {
    render(<AhrefsTool keyword="" />);
    expect(screen.getByRole('button', { name: '打开查询' })).toBeDisabled();
  });
  it('点击打开 ahrefs 关键词难度链接，含 input=apple', () => {
    const spy = vi.spyOn(chrome.tabs, 'create');
    render(<AhrefsTool keyword="apple" />);
    fireEvent.click(screen.getByRole('button', { name: '打开查询' }));
    expect(spy).toHaveBeenCalledTimes(1);
    const url = spy.mock.calls[0][0].url as string;
    expect(url.startsWith('https://ahrefs.com/keyword-difficulty/')).toBe(true);
    expect(url).toContain('input=apple');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test tests/ahrefs-tool.test.tsx`
Expected: FAIL（`AhrefsTool` 当前不接收 `keyword` prop，`getByText('关键词难度查询')` 找不到）

- [ ] **Step 3: 改造实现**

用以下内容**整体替换** `entrypoints/sidepanel/pages/AhrefsTool.tsx`：

```tsx
import { useEffect, useState } from 'react';
import Button from '../components/Button';
import TextInput from '../components/TextInput';
import Select from '../components/Select';
import ToolPanel from '../components/ToolPanel';
import { AhrefsLogo } from '../components/brand-logos';
import { COUNTRIES, buildAhrefsUrl, isValidCountryCode } from '@lib/ahrefs/url';

const STORAGE_KEY = 'ahrefs:last';
interface Last { country: string; }
interface Props { keyword: string; }

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 };

export default function AhrefsTool({ keyword }: Props) {
  const [country, setCountry] = useState('us');
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (items) => {
      const last = items[STORAGE_KEY] as Last | undefined;
      if (last?.country) setCountry(last.country);
    });
  }, []);

  const options = [...COUNTRIES.map((c) => ({ value: c.code, label: c.label })), { value: '__custom', label: '自定义…' }];

  function open() {
    try {
      const url = buildAhrefsUrl(country, keyword);
      chrome.storage.local.set({ [STORAGE_KEY]: { country } });
      chrome.tabs.create({ url });
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <ToolPanel logo={<AhrefsLogo size={18} />} title="Ahrefs" subtitle="关键词难度查询">
      <label style={labelStyle}>国家</label>
      <Select
        value={country}
        options={options}
        onChange={(e) => {
          if (e.target.value === '__custom') { setCustom(true); setCountry(''); }
          else { setCustom(false); setCountry(e.target.value); }
        }}
      />
      {custom && (
        <TextInput
          value={country}
          placeholder="两位代码，如 us"
          onChange={(e) => setCountry(e.target.value)}
          style={{ marginTop: 8 }}
        />
      )}
      {error && <div style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 6 }}>{error}</div>}
      <Button
        onClick={open}
        disabled={!keyword.trim() || !isValidCountryCode(country)}
        style={{ marginTop: 'var(--space-sm)', width: '100%' }}
      >
        打开查询
      </Button>
    </ToolPanel>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test tests/ahrefs-tool.test.tsx`
Expected: PASS（3 passed）

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/pages/AhrefsTool.tsx tests/ahrefs-tool.test.tsx
git commit -m "refactor(sidepanel): AhrefsTool 复用公共关键词 + ToolPanel + logo"
```

---

### Task 8: 改造 KeywordTools（公共关键词 + 三卡片）

**Files:**
- Modify: `entrypoints/sidepanel/pages/KeywordTools.tsx`
- Modify: `tests/keywordtools.test.tsx`

**Interfaces:**
- Consumes: `AhrefsTool` / `GoogleTrendsTool` / `QuickSearchTool`（Task 5–7）；现有 `TextInput`。
- Produces: `default export KeywordTools` 持有 `keyword` state，渲染 `<h2>关键词工具</h2>` + 公共关键词 `TextInput`（placeholder `如 apple`，**必须保留以维持现有测试**）+ 三张卡片。持久化 `chrome.storage.local['kw-tools:keyword']`。

- [ ] **Step 1: 更新测试（先写期望）**

用以下内容**整体替换** `tests/keywordtools.test.tsx`：

```tsx
// tests/keywordtools.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KeywordTools from '../entrypoints/sidepanel/pages/KeywordTools';

describe('KeywordTools', () => {
  it('渲染板块标题、公共关键词输入与三张工具卡片', () => {
    render(<KeywordTools />);
    expect(screen.getByText('关键词工具')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('如 apple')).toBeInTheDocument();
    // Ahrefs
    expect(screen.getByText('Ahrefs')).toBeInTheDocument();
    expect(screen.getByText('关键词难度查询')).toBeInTheDocument();
    // Google Trends
    expect(screen.getByText('Google Trends')).toBeInTheDocument();
    expect(screen.getByText('谷歌趋势')).toBeInTheDocument();
    // 快捷搜索
    expect(screen.getByText('快捷搜索')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '用 Google 搜' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '用 Bing 搜' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test tests/keywordtools.test.tsx`
Expected: FAIL（`getByText('Ahrefs')` 等找不到——当前 `KeywordTools` 未渲染三卡片）

- [ ] **Step 3: 改造实现**

用以下内容**整体替换** `entrypoints/sidepanel/pages/KeywordTools.tsx`：

```tsx
import { useEffect, useState } from 'react';
import TextInput from '../components/TextInput';
import AhrefsTool from './AhrefsTool';
import GoogleTrendsTool from './GoogleTrendsTool';
import QuickSearchTool from './QuickSearchTool';

const STORAGE_KEY = 'kw-tools:keyword';

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 };

export default function KeywordTools() {
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (items) => {
      const kw = items[STORAGE_KEY] as string | undefined;
      if (kw) setKeyword(kw);
    });
  }, []);

  function onChange(value: string) {
    setKeyword(value);
    chrome.storage.local.set({ [STORAGE_KEY]: value });
  }

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <h2 style={{ fontSize: 17, marginBottom: 'var(--space-md)' }}>关键词工具</h2>
      <label style={labelStyle}>关键词</label>
      <TextInput value={keyword} placeholder="如 apple" onChange={(e) => onChange(e.target.value)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
        <AhrefsTool keyword={keyword} />
        <GoogleTrendsTool keyword={keyword} />
        <QuickSearchTool keyword={keyword} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test tests/keywordtools.test.tsx`
Expected: PASS（1 passed）

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/pages/KeywordTools.tsx tests/keywordtools.test.tsx
git commit -m "refactor(sidepanel): KeywordTools 公共关键词 + 三卡片"
```

---

### Task 9: 全量验证（测试 / 类型 / 构建 / manifest）

**Files:** 无代码改动（验证性任务；仅当验证发现问题时才改）。

- [ ] **Step 1: 全量单测**

Run: `pnpm test`
Expected: 全绿（含原有用例 + 新增 trends/quicksearch/logo/toolpanel/工具卡片/keywordtools 用例）。

- [ ] **Step 2: 类型检查**

Run: `pnpm compile`
Expected: 无错误（`tsc --noEmit` 通过）。

- [ ] **Step 3: 构建**

Run: `pnpm build`
Expected: WXT 构建成功，无 TS / 打包错误。

- [ ] **Step 4: manifest 权限核对**

打开 `wxt.config.ts`，确认 `permissions` 含 `tabs`（已有），且本次未新增 host_permissions。

构建产物手动验证点（在浏览器加载 `.output/` 下产物后）：在关键词工具输入 `apple`，分别点击 Ahrefs / 趋势 / Google / Bing 按钮，确认各自在新标签打开正确结果页；若 `chrome.tabs.create` 打开 google.com / cn.bing.com 受阻（理论上不会），才回退新增 `https://www.google.com/*`、`https://cn.bing.com/*`、`https://trends.google.com/*` 到 `host_permissions` 并重新构建。

- [ ] **Step 5: 提交（仅当 Step 4 触发了 manifest 改动）**

若无改动则跳过。若有：

```bash
git add wxt.config.ts
git commit -m "fix(manifest): 补充快捷搜索/趋势 host_permissions"
```

---

## Self-Review

**Spec 覆盖：**
- 公共关键词 + 持久化 → Task 8 ✓
- Trends 工具（天数/对比词/地区/URL 拼接/新标签）→ Task 1（url）+ Task 5（卡片）✓
- 快捷搜索（google/bing、search?q=、两按钮）→ Task 2（url）+ Task 6（卡片）✓
- Ahrefs 改造（接收 keyword、标"关键词难度查询"、保留国家）→ Task 7 ✓
- logo（真实品牌彩色，内联 SVG）→ Task 3（品牌色徽标版，已注明升级路径）✓
- ToolPanel 共享壳 → Task 4 ✓
- 记忆策略（kw-tools:keyword / kw-tools:trends / ahrefs:last 仅 country）→ Task 5/7/8 ✓
- 错误处理（空关键词 disabled、url 抛错 catch、Ahrefs 国家校验）→ Task 5/6/7/8 ✓
- 测试（trends/quicksearch url 单测）→ Task 1/2 ✓；组件测试补充 → Task 3–8 ✓
- manifest 预期不改 → Task 9 Step 4 ✓

**类型一致性：** `TRENDS_DATE_RANGES` / `TRENDS_GEOS` 在 Task 1 定义为 `{ value; label }`，Task 5 `Select` 的 `options` map 到 `{ value; label }` 一致；`buildTrendsUrl(keyword, compare, date, geo)` 签名 Task 1 定义、Task 5 调用一致；`buildGoogleSearchUrl` / `buildBingSearchUrl`（Task 2）签名与 Task 6 调用一致；`AhrefsTool` / `GoogleTrendsTool` / `QuickSearchTool` 均为 `{ keyword: string }` props，Task 8 调用一致；`ToolPanel` props（Task 4）与 Task 5/6/7 调用一致。

**Placeholder 扫描：** 无 TBD/TODO；每步含完整代码或精确命令与预期输出。logo 任务的品牌色徽标为完整可运行代码（非占位），升级路径为可选说明。

**潜在偏离说明（供执行者/审阅者知悉）：** Task 3 的 logo 为品牌色徽标（四色点 / 品牌色底 + 标志），可识别但非像素级官方 logo 轮廓——这是为避免凭记忆写错复杂 path 而采用的稳妥完整实现，spec 的"可识别"目标已达成，精确官方轮廓可作为后续单独替换。
