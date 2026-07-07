# 网站工具面板：灵活访问与网址实时清洗

> 日期：2026-07-07
> 状态：设计待评审

## 背景

QuickSEO 侧边栏的「网站工具」面板（`entrypoints/sidepanel/pages/SiteTools.tsx`）当前对所有工具（快捷工具 / 站长后台 / 网站分析）使用统一的禁用开关：只要输入框没有通过校验的有效域名（`hasSite = isValidDomain(normalizeDomain(site.domain))` 为 false），三个分类下的全部按钮都被 `disabled`。

这带来两个问题：

1. **过度禁用**：「站长后台」「网站分析」下的工具（GSC、Bing Webmaster、GA、Clarity、PageSpeed）的跳转目标本就是各自平台的入口页，`buildUrl` 全是 `() => 常量URL`，根本不依赖域名；「快捷工具」里的 Ahrefs 反链/权重查询也能在无网站时跳到工具首页。它们被一起禁用是不合理的。
2. **网址输入无实时校验**：输入框 `onChange` 时原文落库（不清洗），只在失焦时用 `normalizeDomain` 清洗一次。用户粘贴 `https://example.com/path?q=1` 这类完整 URL 时，在失焦前一直以原文形态存在，体验不佳。

## 目标

1. 解除「无网站即全禁」的限制，按工具是否真正需要域名做差异化启用。
2. 网址输入框在输入过程中实时截取，自动剥掉协议头/路径/query 等，仅保留域名（清洗失败/未成形时保留原文，不打断输入）。

## 非目标（YAGNI）

- 不做 IDN/中文域名支持（现状即不支持，超出本次范围）。
- 不给「站长后台」「网站分析」工具带域名参数（包括 PageSpeed 的 `?url=`）——保持各自入口页跳转。
- 不重构现有的三处 URL 规整函数（`normalizeDomain` / `normalizeOrigin` / `toHost`）的重复逻辑。

## 设计

### 1. 工具差异化禁用：`requiresDomain` 标志

在 `lib/site-tools/tools.ts` 的工具数据结构增加可选字段 `requiresDomain: boolean`（默认 `false`）。只有真正必须拼接域名才能访问的工具设为 `true`。

| 分类 | 工具 | `requiresDomain` | 无网站行为 | 有网站行为 |
|---|---|---|---|---|
| 快捷工具 | robots.txt / sitemap.xml | `true` | 禁用（置灰） | 带域名拼接（不变） |
| 快捷工具 | backlink-checker / authority-checker | `false` | 可点，跳 Ahrefs 工具首页 | 带域名跳转（不变） |
| 站长后台 | GSC / Bing | `false` | 可点，跳入口（不变） | 跳入口（不变） |
| 网站分析 | GA / Clarity / PageSpeed | `false` | 可点，跳入口（不变） | 跳入口（不变） |

`SiteTools.tsx` 的 `disabled` 从 `!hasSite` 改为：

```ts
const disabled = (t.requiresDomain === true) && !hasSite;
```

### 2. `buildUrl` 签名统一为 `(domain: string | null) => string`

- **robots/sitemap**（`requiresDomain: true`）：调用时 domain 必非空（禁用态不会触发点击）。buildUrl 内部用非空断言：`(d) => buildSeoFileUrl(d!, 'robots.txt')`。
- **backlink-checker / authority-checker**：改为支持 null ——
  ```ts
  buildUrl: (d) => d ? buildBacklinkCheckerUrl(d) : 'https://ahrefs.com/backlink-checker'
  ```
  authority 同理跳 `https://ahrefs.com/website-authority-checker`。
- **站长后台 / 网站分析**：buildUrl 忽略参数，返回常量 URL（现状不变，仅签名从 `() => url` 调整为 `(_d) => url`）。

`openTool` 改为：

```ts
function openTool(buildUrl: (domain: string | null) => string) {
  try { chrome.tabs.create({ url: buildUrl(hasSite ? site.domain : null) }); }
  catch { /* tabs.create 失败静默 */ }
}
```

去掉原 `openTool` 内 `if (!hasSite) return` 的二次防御（已由 `disabled` + `requiresDomain` 保证不会误触发；站长后台/网站分析本就允许无网站跳转）。

`ToolCard` 的 `onClick`：`!disabled ? () => openTool(t.buildUrl) : undefined`。

### 3. 网址输入实时截取：`sanitizeDomainInput`

新增工具函数，紧挨 `normalizeDomain` 放在 `lib/storage/projects.ts`：

```ts
/**
 * 输入过程中的实时域名清洗：剥掉协议头/路径/query 等，仅保留主机名。
 * 清洗失败或输入未成形时保留原文，避免打断用户输入（如逐字输入、中文）。
 */
export function sanitizeDomainInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;        // 空输入保留，让用户能清空
  const n = normalizeDomain(raw);
  return n || raw;                 // normalize 失败 → 保留原文
}
```

**`Combobox` 通用组件不硬编码域名逻辑**，改为增加可选 prop：

```ts
sanitize?: (value: string) => string;
```

`onChange` 内：

```ts
const v = sanitize ? sanitize(e.target.value) : e.target.value;
onChange(v);
setQuery(v);
setOpen(true);
```

`SiteTools.tsx` 渲染 `Combobox` 时传入 `sanitize={sanitizeDomainInput}`。

`handleSiteBlur`（失焦清洗）保留作为兜底（例如 Combobox 未触发 sanitize 的路径，或未来其他调用方）。

### 4. 底部提示文案调整

当前无网站时显示「请先选择或填写网站以使用工具」，在新策略下不再准确（大部分工具无网站也能用）。改为：

- **无网站且未输入有效域名**：轻量引导文案，如「填写网站可额外查询 robots.txt / sitemap.xml」（解释为什么这两个置灰）。
- **输入了但清洗后无效（`showInvalid`）**：保留红色「请输入有效域名，如 example.com」。
- **有网站**：不显示提示。

## 涉及文件

| 文件 | 改动 |
|---|---|
| `lib/site-tools/tools.ts` | 加 `requiresDomain` 字段；backlink/authority 的 buildUrl 支持 null；统一 buildUrl 签名 |
| `entrypoints/sidepanel/pages/SiteTools.tsx` | disabled/onClick/openTool 改逻辑；Combobox 传 sanitize；底部提示文案调整 |
| `entrypoints/sidepanel/components/Combobox.tsx` | 加可选 `sanitize` prop，onChange 应用 |
| `lib/storage/projects.ts` | 新增 `sanitizeDomainInput` |
| `tests/sitetools.test.tsx` | 更新 disabled 断言；新增无网站跳转、实时清洗用例 |

## 测试要点

**组件行为（`tests/sitetools.test.tsx`）：**
- 无网站时：GSC/Bing/GA/Clarity/PageSpeed/backlink-checker/authority-checker 按钮**不 disabled**；robots/sitemap **disabled**。
- 无网站点击 backlink-checker → 打开 `https://ahrefs.com/backlink-checker`；有网站 → 打开带 `?input=...` 的 URL。
- 有网站点击 robots → 打开 `https://<domain>/robots.txt`。
- 输入 `https://example.com/path?q=1` → 输入框值实时变为 `example.com`。

**纯函数（`tests/` 下 projects 相关测试或新增）：**
- `sanitizeDomainInput('https://example.com/path?q=1')` → `example.com`
- `sanitizeDomainInput('http://www.example.com')` → `www.example.com`
- `sanitizeDomainInput('example.com')` → `example.com`
- `sanitizeDomainInput('exa')` → `exa`（未成形，保留）
- `sanitizeDomainInput('')` → `''`
- `sanitizeDomainInput('中文.com')` → `中文.com`（非 ASCII，normalize 失败，保留原文）

## 决策记录

1. **robots/sitemap 无网站时禁用**（而非跳帮助页）：这两个工具离了域名无有意义跳转目标，置灰最稳妥。
2. **网址截取在输入时实时进行**（而非仅失焦）：对「粘贴完整 URL」这一最常见场景最友好；逐字输入未成形文本时保留原文，不打断。
3. **底部提示改为轻量引导**（默认决策，未单独确认）：解释 robots/sitemap 置灰原因，避免误导用户以为所有工具都需要网站。
4. **PageSpeed 不带 `?url=`**（默认决策，未单独确认）：尊重「网站分析不需要带网站链接」的产品定位；PSI 支持 `?url=` 可作为后续增强，本次不做。

## 风险与边界

- **实时清洗的光标跳动**：当用户输入会被剥掉的字符（如 `/`、`?`）时，受控 input 的 value 被替换会导致光标跳到末尾。这发生在「误输入路径/query」场景，可接受；纯域名逐字输入不受影响。
- **buildUrl 类型安全**：`requiresDomain:true` 的工具 buildUrl 用非空断言 `d!`，安全性由 disabled 逻辑保证（禁用态不调用）。可在 openTool 调用处加注释说明该不变量。
