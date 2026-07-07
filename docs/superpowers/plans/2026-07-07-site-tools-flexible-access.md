# 网站工具面板：灵活访问与网址实时清洗 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解除「网站工具面板」无网站即全禁用的限制（按工具是否真正需要域名做差异化启用），并让网址输入框在输入过程中实时截取、仅保留域名。

**Architecture:** 在工具数据表 `SITE_TOOLS` 增加可选 `requiresDomain` 标志，把 `disabled` 从「面板统一 `!hasSite`」改为「按工具 `t.requiresDomain && !hasSite`」；`buildUrl` 签名统一为 `(domain: string | null) => string`，让无网站也可跳转的工具（Ahrefs 反链/权重、站长后台、网站分析）返回各自入口页。给通用 `Combobox` 加可选 `sanitize` prop，由 `SiteTools` 传入新增的 `sanitizeDomainInput`，实现 onChange 实时清洗。

**Tech Stack:** React 19 + TypeScript 5.9 + WXT 0.20 + Vitest 3 + @testing-library/react 16

## Global Constraints

- 包管理器是 **pnpm**。测试：`pnpm test`（= `vitest run`）。类型检查：`pnpm compile`（= `tsc --noEmit`）。
- **提交规则**：遵循用户全局规则——仅在用户明确要求时执行 `git commit`/`push`。计划中每个任务的 commit 步骤在执行时需先与用户确认；若用户未要求提交，跳过该步骤即可（不要擅自提交）。
- `buildUrl` 签名统一为 `(domain: string | null) => string`（Task 2 落地，全文件遵循）。
- `requiresDomain` 默认 `false`（缺省 = 始终可点击）；只有 robots/sitemap 设 `true`。
- 不引入新依赖。不改动 `normalizeDomain`/`normalizeOrigin`/`toHost` 现有实现。
- commit message 沿用仓库 conventional commits 中文风格（参考 `feat(site-tools): ...`）。

---

## File Structure

| 文件 | 责任 | 本次改动 |
|---|---|---|
| `lib/storage/projects.ts` | 域名清洗/校验纯函数 | 新增 `sanitizeDomainInput` |
| `lib/site-tools/tools.ts` | 工具数据表与 `SiteTool` 接口 | 加 `requiresDomain`；backlink/authority 的 buildUrl 支持 null；buildUrl 签名调整 |
| `entrypoints/sidepanel/components/Combobox.tsx` | 通用网址输入框 | 加可选 `sanitize` prop |
| `entrypoints/sidepanel/pages/SiteTools.tsx` | 工具面板页面 | disabled/onClick/openTool 改逻辑；传 sanitize；底部提示文案 |
| `tests/domain-normalize.test.ts` | `sanitizeDomainInput` 单测 | 新增 describe |
| `tests/combobox.test.tsx` | `Combobox` 单测 | 新增 sanitize 用例 |
| `tests/sitetools.test.tsx` | 面板集成测试 | 更新 PageSpeed 用例；新增无网站可点击、实时清洗用例 |

---

## Task 1: 新增 `sanitizeDomainInput` 纯函数

**Files:**
- Modify: `lib/storage/projects.ts`（在 `normalizeDomain` 之后新增函数）
- Test: `tests/domain-normalize.test.ts`

**Interfaces:**
- Consumes: `normalizeDomain`（同文件已有）
- Produces: `export function sanitizeDomainInput(raw: string): string` —— 输入过程中的实时域名清洗，剥掉 scheme/path/query 等，清洗失败或未成形时保留原文。

- [ ] **Step 1: 写失败测试**

在 `tests/domain-normalize.test.ts` 顶部 import 补上 `sanitizeDomainInput`，并在文件末尾追加新 describe：

```ts
// 第 2 行改为：
import { normalizeDomain, isValidDomain, sanitizeDomainInput } from '../lib/storage/projects';
```

```ts
// 文件末尾追加：
describe('sanitizeDomainInput', () => {
  it('实时剥掉 scheme / path / query，仅保留主机名', () => {
    expect(sanitizeDomainInput('https://example.com/path?q=1')).toBe('example.com');
    expect(sanitizeDomainInput('http://www.example.com/')).toBe('www.example.com');
  });
  it('已是裸域名则原样返回', () => {
    expect(sanitizeDomainInput('example.com')).toBe('example.com');
  });
  it('未成形输入保留原文，不打断逐字输入', () => {
    expect(sanitizeDomainInput('exa')).toBe('exa');
    expect(sanitizeDomainInput('http://')).toBe('http://');
  });
  it('空输入保留空串', () => {
    expect(sanitizeDomainInput('')).toBe('');
  });
  it('非 ASCII 输入保留原文（normalizeDomain 不支持 IDN）', () => {
    expect(sanitizeDomainInput('例子.中国')).toBe('例子.中国');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test tests/domain-normalize.test.ts`
Expected: FAIL，报 `sanitizeDomainInput is not exported`（函数尚未定义）。

- [ ] **Step 3: 实现 `sanitizeDomainInput`**

在 `lib/storage/projects.ts` 的 `normalizeDomain` 函数之后（第 24 行 `}` 之后）插入：

```ts
/**
 * 输入过程中的实时域名清洗：剥掉 scheme / path / query / fragment / 端口等，
 * 仅保留主机名（小写）。与 normalizeDomain 的区别：当输入未成形（如逐字输入
 * 的中间态、非 ASCII、解析失败）时保留原文而非返回空串，避免打断用户输入。
 * 空输入返回原值，让用户能正常清空输入框。
 */
export function sanitizeDomainInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;        // 空输入保留原值
  const n = normalizeDomain(raw);
  return n || raw;                 // normalize 失败 → 保留原文
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test tests/domain-normalize.test.ts`
Expected: PASS（全部用例，包括新增 5 条）。

- [ ] **Step 5: 提交（需先与用户确认）**

```bash
git add lib/storage/projects.ts tests/domain-normalize.test.ts
git commit -m "feat(site-tools): 新增 sanitizeDomainInput 输入实时清洗纯函数"
```

---

## Task 2: 工具差异化启用（`requiresDomain` + `buildUrl` 支持 null）

**Files:**
- Modify: `lib/site-tools/tools.ts`
- Modify: `entrypoints/sidepanel/pages/SiteTools.tsx`
- Test: `tests/sitetools.test.tsx`

**Interfaces:**
- Consumes: 无（独立任务）
- Produces:
  - `SiteTool` 接口新增 `requiresDomain?: boolean`
  - `SiteTool.buildUrl` 签名变为 `(domain: string | null) => string`
  - `SiteTools` 的 `openTool` 签名变为 `(buildUrl: (domain: string | null) => string) => void`

- [ ] **Step 1: 写失败测试**

在 `tests/sitetools.test.tsx` 中做三处改动：

**(a)** 把第 80-85 行的 `'未选网站时 PageSpeed Insights 禁用'` 整体替换为：

```ts
  it('未选网站时 PageSpeed Insights 可点击并跳首页（不依赖域名）', async () => {
    const spy = vi.spyOn(chrome.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    render(<SiteTools />);
    await flush();
    const card = screen.getByText('PageSpeed Insights').closest('[role="button"], .tool-card');
    expect(card?.getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(screen.getByText('PageSpeed Insights'));
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0].url).toBe('https://pagespeed.web.dev/');
    spy.mockRestore();
  });
  it('未选网站时 Backlink Checker 可点击并跳工具首页（不带域名）', async () => {
    const spy = vi.spyOn(chrome.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    render(<SiteTools />);
    await flush();
    const card = screen.getByText('Backlink Checker').closest('[role="button"], .tool-card');
    expect(card?.getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(screen.getByText('Backlink Checker'));
    expect(spy.mock.calls[0][0].url).toBe('https://ahrefs.com/backlink-checker');
    spy.mockRestore();
  });
  it('未选网站时 GSC 可点击并跳入口（不带域名）', async () => {
    const spy = vi.spyOn(chrome.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    render(<SiteTools />);
    await flush();
    fireEvent.click(screen.getByText('GSC'));
    expect(spy.mock.calls[0][0].url).toBe('https://search.google.com/search-console');
    spy.mockRestore();
  });
  it('未选网站时显示轻量引导文案（而非全量禁用提示）', async () => {
    render(<SiteTools />);
    await flush();
    expect(screen.getByText('填写网站可额外查询 robots.txt / sitemap.xml')).toBeInTheDocument();
  });
```

**(b)** 第 39-45 行的 `'未选网站时 robots.txt 禁用'` 保持不变（robots 仍需禁用），但在其后追加一条 sitemap 用例：

```ts
  it('未选网站时 sitemap.xml 同样禁用', async () => {
    render(<SiteTools />);
    await flush();
    const sitemap = screen.getByText('sitemap.xml').closest('[role="button"], .tool-card');
    expect(sitemap?.getAttribute('aria-disabled')).toBe('true');
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test tests/sitetools.test.tsx`
Expected: FAIL —— PageSpeed/Backlink/GSC 用例期望 `aria-disabled` 不为 `'true'` 但实际为 `'true'`（当前统一禁用）；引导文案用例找不到目标文本。

- [ ] **Step 3: 改 `lib/site-tools/tools.ts`**

把 `SiteTool` 接口（第 14-26 行）替换为：

```ts
export interface SiteTool {
  id: string;
  name: string;
  category: SiteToolCategory;
  /** 图片 logo url(与 icon 二选一)。 */
  logo?: string;
  /** SVG icon 标记(robots/sitemap 用,与 logo 二选一)。 */
  icon?: 'robots' | 'sitemap';
  /** 构造打开 url;domain 为 null 表示当前无网站(仅 requiresDomain 未设/为 false 的工具会被这样调用)。 */
  buildUrl: (domain: string | null) => string;
  /** true = 必须有有效网站才能使用(无网站时禁用);缺省 false = 始终可点击。 */
  requiresDomain?: boolean;
  /** 标题较长,在两列网格里会折行,标记后在网格中独占整行。 */
  fullWidth?: boolean;
}
```

把 `SITE_TOOLS` 数组（第 35-45 行）替换为：

```ts
export const SITE_TOOLS: SiteTool[] = [
  { id: 'robots', name: 'robots.txt', category: 'quick', icon: 'robots', requiresDomain: true, buildUrl: (d) => buildSeoFileUrl(d!, 'robots.txt') },
  { id: 'sitemap', name: 'sitemap.xml', category: 'quick', icon: 'sitemap', requiresDomain: true, buildUrl: (d) => buildSeoFileUrl(d!, 'sitemap.xml') },
  { id: 'backlink-checker', name: 'Backlink Checker', category: 'quick', logo: backlinkLogo, buildUrl: (d) => (d ? buildBacklinkCheckerUrl(d) : 'https://ahrefs.com/backlink-checker'), fullWidth: true },
  { id: 'authority-checker', name: 'Website Authority Checker', category: 'quick', logo: authorityLogo, buildUrl: (d) => (d ? buildWebsiteAuthorityCheckerUrl(d) : 'https://ahrefs.com/website-authority-checker'), fullWidth: true },
  { id: 'gsc', name: 'GSC', category: 'webmaster', logo: gscLogo, buildUrl: () => 'https://search.google.com/search-console' },
  { id: 'bing-webmaster', name: 'Bing', category: 'webmaster', logo: bingLogo, buildUrl: () => 'https://www.bing.com/webmasters' },
  { id: 'ga', name: 'Google Analytics', category: 'analytics', logo: gaLogo, buildUrl: () => 'https://analytics.google.com/analytics/web' },
  { id: 'clarity', name: 'Microsoft Clarity', category: 'analytics', logo: clarityLogo, buildUrl: () => 'https://clarity.microsoft.com/projects/view' },
  { id: 'pagespeed', name: 'PageSpeed Insights', category: 'analytics', logo: pagespeedLogo, buildUrl: () => 'https://pagespeed.web.dev/', fullWidth: true },
];
```

> 说明：`gsc`/`bing`/`ga`/`clarity`/`pagespeed` 的 `buildUrl` 仍是 `() => url`，TS 允许少参数函数赋给 `(d: string | null) => string`，无需改动。`d!` 非空断言的安全性由 disabled 逻辑保证（requiresDomain=true 且无网站时按钮禁用，不会调用）。

- [ ] **Step 4: 改 `entrypoints/sidepanel/pages/SiteTools.tsx`**

**(a)** 把 `openTool`（第 40-44 行）替换为（去掉 `if (!hasSite) return` 二次防御，签名跟随 buildUrl）：

```ts
  function openTool(buildUrl: (domain: string | null) => string) {
    try { chrome.tabs.create({ url: buildUrl(hasSite ? site.domain : null) }); }
    catch { /* tabs.create 失败静默(扩展上下文异常等,不阻塞 UI) */ }
  }
```

**(b)** 把 ToolCard 渲染块（第 72-82 行）替换为（按工具计算 disabled）：

```tsx
              {SITE_TOOLS.filter((t) => t.category === g.id).map((t) => {
                const disabled = t.requiresDomain === true && !hasSite;
                return (
                  <ToolCard
                    key={t.id}
                    icon={toolIcon(t)}
                    logo={t.logo}
                    title={t.name}
                    onClick={!disabled ? () => openTool(t.buildUrl) : undefined}
                    disabled={disabled}
                    style={t.fullWidth ? { gridColumn: '1 / -1' } : undefined}
                  />
                );
              })}
```

**(c)** 把底部提示块（第 88-92 行）替换为（仅改 else 分支文案）：

```tsx
      {!hasSite && (
        <div style={{ color: showInvalid ? 'var(--color-error)' : 'var(--color-muted)', fontSize: 12, marginTop: 'var(--space-sm)' }}>
          {showInvalid ? '请输入有效域名，如 example.com' : '填写网站可额外查询 robots.txt / sitemap.xml'}
        </div>
      )}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm test tests/sitetools.test.tsx`
Expected: PASS（全部用例，包括新增/改写的）。

- [ ] **Step 6: 类型检查**

Run: `pnpm compile`
Expected: 无错误（重点确认 `d!` 非空断言与 buildUrl 签名变更不引发 TS 报错）。

- [ ] **Step 7: 提交（需先与用户确认）**

```bash
git add lib/site-tools/tools.ts entrypoints/sidepanel/pages/SiteTools.tsx tests/sitetools.test.tsx
git commit -m "feat(site-tools): 解除无网站全禁用,按 requiresDomain 差异化启用"
```

---

## Task 3: 网址输入框实时清洗接入（Combobox `sanitize` prop）

**Files:**
- Modify: `entrypoints/sidepanel/components/Combobox.tsx`
- Modify: `entrypoints/sidepanel/pages/SiteTools.tsx`
- Test: `tests/combobox.test.tsx`
- Test: `tests/sitetools.test.tsx`

**Interfaces:**
- Consumes: `sanitizeDomainInput`（来自 Task 1，`lib/storage/projects`）
- Produces: `ComboboxProps.sanitize?: (value: string) => string`

- [ ] **Step 1: 写 Combobox 的失败测试**

在 `tests/combobox.test.tsx` 末尾（第 36 行 `});` 之前）追加两条用例：

```ts
  it('传入 sanitize 时对输入实时清洗后回调', () => {
    const onChange = vi.fn();
    const { container } = render(<Combobox value="" options={[]} onChange={onChange} sanitize={(v) => v.toUpperCase()} />);
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('ABC');
  });
  it('未传 sanitize 时原文透传', () => {
    const onChange = vi.fn();
    const { container } = render(<Combobox value="" options={[]} onChange={onChange} />);
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test tests/combobox.test.tsx`
Expected: 第一条 FAIL —— 当前 onChange 原样回调 `'abc'`，期望 `'ABC'`。第二条 PASS（现状即原文透传）。

- [ ] **Step 3: 改 `entrypoints/sidepanel/components/Combobox.tsx`**

**(a)** `ComboboxProps` 接口（第 4-11 行）末尾加一个字段：

```ts
export interface ComboboxProps {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onManage?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  /** 输入时实时清洗(如剥掉协议头/路径仅保留域名);返回值同时回写 input 与 onChange。 */
  sanitize?: (value: string) => string;
}
```

**(b)** 函数签名解构（第 13 行）补 `sanitize`：

```ts
export default function Combobox({ value, options, onChange, onManage, onBlur, placeholder, sanitize }: ComboboxProps) {
```

**(c)** input 的 `onChange`（第 31 行）改为先过 sanitize：

```tsx
          onChange={(e) => { const v = sanitize ? sanitize(e.target.value) : e.target.value; onChange(v); setQuery(v); setOpen(true); }}
```

> 注：建议项的 `onMouseDown`（第 51 行）不改——下拉项来自已存的合法 `project.domain`，无需再次清洗。

- [ ] **Step 4: 跑 Combobox 测试确认通过**

Run: `pnpm test tests/combobox.test.tsx`
Expected: PASS（全部用例）。

- [ ] **Step 5: 把 `sanitizeDomainInput` 接入 `SiteTools`**

**(a)** `entrypoints/sidepanel/pages/SiteTools.tsx` 第 10 行 import 补 `sanitizeDomainInput`：

```ts
import { isValidDomain, normalizeDomain, sanitizeDomainInput } from '@lib/storage/projects';
```

**(b)** 第 54 行的 `<Combobox ... />` 加 `sanitize` prop：

```tsx
      <Combobox value={site.domain} options={domains} placeholder="example.com" sanitize={sanitizeDomainInput} onChange={(v) => setSite({ domain: v })} onBlur={handleSiteBlur} onManage={() => setModalOpen(true)} />
```

- [ ] **Step 6: 更新 `tests/sitetools.test.tsx` 反映实时清洗语义**

把第 97-114 行的 `'脏域名 change 后即启用按钮（hasSite 前置 normalize），失焦后清洗回填'` 整体替换为（change 时即清洗，无需失焦）：

```ts
  it('脏域名 change 时实时清洗为裸域名（无需失焦）', async () => {
    const createSpy = vi.spyOn(chrome.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    render(<SiteTools />);
    await flush();
    const input = screen.getByPlaceholderText('example.com') as HTMLInputElement;
    // 输入完整 URL,change 时即实时清洗为裸域名(无需失焦)
    fireEvent.change(input, { target: { value: 'https://example.com/path' } });
    expect(input.value).toBe('example.com');
    // 清洗后即启用 robots
    const robots = screen.getByText('robots.txt').closest('[role="button"], .tool-card');
    expect(robots?.getAttribute('aria-disabled')).not.toBe('true');
    // 点击使用清洗后的域名
    fireEvent.click(screen.getByText('robots.txt'));
    expect(createSpy.mock.calls[0][0].url).toBe('https://example.com/robots.txt');
    createSpy.mockRestore();
  });
```

> 第 123-133 行的 `'非 ASCII 输入失焦不清空，仍显示校验提示'` 无需改动：`sanitizeDomainInput('例子.中国')` 保留原文，行为与断言一致。

- [ ] **Step 7: 跑全部测试确认通过**

Run: `pnpm test`
Expected: PASS（全部测试文件，无回归）。

- [ ] **Step 8: 类型检查**

Run: `pnpm compile`
Expected: 无错误。

- [ ] **Step 9: 提交（需先与用户确认）**

```bash
git add entrypoints/sidepanel/components/Combobox.tsx entrypoints/sidepanel/pages/SiteTools.tsx tests/combobox.test.tsx tests/sitetools.test.tsx
git commit -m "feat(site-tools): 网址输入框实时清洗接入 Combobox sanitize"
```

---

## Self-Review

**1. Spec 覆盖：**
- 「解除无网站全禁用，按工具差异化」→ Task 2 ✓
- 「快捷工具有网站带域名、无网站跳首页；robots/sitemap 无网站禁用」→ Task 2（tools.ts buildUrl + requiresDomain）✓
- 「站长后台/网站分析始终可点击」→ Task 2（requiresDomain 缺省 false + openTool 传 null）✓
- 「网址输入实时截取 http/路径，仅保留域名」→ Task 1（函数）+ Task 3（接入）✓
- 「底部提示文案调整」→ Task 2 Step 4(c) ✓

**2. 占位符扫描：** 无 TBD/TODO；每个步骤均含完整代码与确切命令。

**3. 类型一致性：**
- `sanitizeDomainInput(raw: string): string` —— Task 1 定义，Task 3 消费，签名一致 ✓
- `SiteTool.buildUrl: (domain: string | null) => string` —— Task 2 定义接口与所有工具项，`openTool` 签名同步 ✓
- `SiteTool.requiresDomain?: boolean` —— Task 2 定义，SiteTools 用 `t.requiresDomain === true` 判定 ✓
- `ComboboxProps.sanitize?: (value: string) => string` —— Task 3 定义，SiteTools 传 `sanitizeDomainInput`（`(raw: string) => string`，兼容）✓

无类型不一致。
