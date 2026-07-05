# 网站工具扩展 + 关键词工具 UI 调整 设计

- 日期:2026-07-05
- 分支:`feat/site-kw-tools-expansion`
- 来源需求:`tmp.md`

## 背景

AutoSEO sidepanel 有两个 tab:网站工具(site)、关键词工具(keyword)。

- 网站工具目前仅 3 个(网站提交 / robots.txt / sitemap.xml),且**硬编码**在 `entrypoints/sidepanel/pages/SiteTools.tsx`。本次补充 6 个常用第三方 SEO/分析工具,并顺势把硬编码重构成数据驱动。
- 关键词工具已有 3 个子工具(关键词难度/Ahrefs、Google Trends、快捷搜索),UI 经多轮紧凑化,本次按 `tmp.md` 进一步精简文案与重排布局,并为快捷搜索新增 Yandex 引擎。

## 目标

1. 网站工具新增 6 个工具(2 个带查询参数、4 个直接打开)。
2. 网站工具从硬编码重构成**数据驱动**。
3. 关键词工具三处 UI 按 `tmp.md` 调整(Ahrefs 文案+布局、Trends 去标题+重排、QuickSearch 改名+加 Yandex+分割线)。
4. 全部新 logo 本地化到 `assets/logos/`。
5. `pnpm test` 全绿。

## 决策记录

| 决策点 | 选择 | 理由 |
|---|---|---|
| logo 资源 | 下载到本地 `assets/logos/` | 与现有 4 个 PNG 模式一致;离线可用;避免 `bing.net/th/id/OIP-C.*` 缩略图链接日后失效 |
| Yandex url | 拼接关键词 `https://yandex.com/search/?text=<kw>` | 与 Google/Bing 行为一致,点了直接出结果 |
| Backlink mode | 固定 `mode=subdomains` | UI 简洁,与网站工具「一键打开」风格一致;`input` 取当前 site 的 domain |
| 网站工具架构 | 数据驱动重构 | 9 个工具硬编码重复,数据驱动易维护/扩展 |

## 一、网站工具数据驱动重构

### 1.1 数据结构(`lib/site-tools/tools.ts`,新建)

```ts
export type SiteTool =
  | { id: string; name: string; logo?: string; icon?: 'robots' | 'sitemap'; kind: 'direct'; url: string }
  | { id: string; name: string; logo?: string; icon?: 'robots' | 'sitemap'; kind: 'input'; buildUrl: (domain: string) => string };

export const SITE_TOOLS: SiteTool[] = [ /* robots, sitemap, backlink, authority, gsc, ga, clarity, pagespeed */ ];
```

> `网站提交`是特殊工具(点击切到内部 `SubmitPanel` 视图,不开 url),保持独立的 `ToolCard`,**不纳入**数据数组。

工具顺序与字段:

| id | name | kind | url / buildUrl |
|---|---|---|---|
| robots | robots.txt | input(复用) | `buildSeoFileUrl(domain,'robots.txt')` |
| sitemap | sitemap.xml | input(复用) | `buildSeoFileUrl(domain,'sitemap.xml')` |
| backlink-checker | Backlink Checker | input | `buildBacklinkCheckerUrl(domain)` |
| authority-checker | Website Authority Checker | input | `buildWebsiteAuthorityCheckerUrl(domain)` |
| gsc | Google Search Console | direct | `https://search.google.com/search-console` |
| ga | Google Analytics | direct | `https://analytics.google.com/analytics/web` |
| clarity | Microsoft Clarity | direct | `https://clarity.microsoft.com/projects/view` |
| pagespeed | PageSpeed Insights | direct | `https://pagespeed.web.dev/` |

robots / sitemap 继续用 SVG `icon`(不引入图片 logo);其余 6 个用 `logo`(图片)。

### 1.2 url builder(`lib/site-tools/url.ts`,新建)

```ts
buildBacklinkCheckerUrl(domain)      // https://ahrefs.com/backlink-checker/?input=<origin>&mode=subdomains
buildWebsiteAuthorityCheckerUrl(domain) // https://ahrefs.com/website-authority-checker/?input=<origin>
```

`input` 复用 `normalizeOrigin`(`lib/seo-files/url.ts` 已有),取 origin 作输入,保证 `vercel.com` / `https://vercel.com/foo` 都规范化为 `vercel.com`。注意 ahrefs 的 input 参数不带协议,只传 host。

### 1.3 ToolCard 改造(`entrypoints/sidepanel/components/ToolCard.tsx`)

新增可选 `logo?: string` prop:

- 有 `logo` → 渲染 `<img src={logo} ... />`(尺寸/样式与现有 `tool-card__icon` 一致)
- 无 `logo` → 渲染现有 `icon`(ReactNode)

两者二选一;`icon` 与 `logo` 至少传一个。

### 1.4 SiteTools.tsx 重构

- 顶部:网站提交,全宽 `ToolCard`(独立,onClick 切 SubmitPanel)。
- 下方:`SITE_TOOLS.map(...)` 渲染,**2 列网格**(`display:grid; grid-template-columns:1fr 1fr; gap`)。
- `kind:'input'` → onClick 调 `buildUrl(site.domain)`;无 site 时 `disabled`。
- `kind:'direct'` → onClick 直接 `chrome.tabs.create({ url })`;无 site 时也可打开(不依赖 domain),但为一致性,仍受 `hasSite` 控制(待实施时确认 — 见歧义 §8.1)。

### 1.5 布局示意

```
┌──────────────────────────────────┐
│           网站提交                │  全宽
├──────────────┬───────────────────┤
│  robots.txt  │  sitemap.xml       │
│ Backlink     │ Website Authority  │
│ Google SC    │ Google Analytics   │
│ MS Clarity   │ PageSpeed Insights │
└──────────────┴───────────────────┘
```

## 二、AhrefsTool(关键词难度)

文件:`entrypoints/sidepanel/pages/AhrefsTool.tsx`

| 项 | 现状 | 改为 |
|---|---|---|
| subtitle | `关键词难度查询` | `Keyword Difficulty Checker` |
| logo 资源 | `ahrefs.png` | `keyword-difficulty-checker.svg`(`brand-logos.tsx` 的 `AhrefsLogo` 换 import) |
| "国家"标签 | 有(`rowLabelStyle` span) | 删除 |
| 查询按钮位置 | header `action` | 下放到内容区,与国家 Select 同一 flex 行 |
| 按钮文案 | `打开查询` | `查询` |

布局:一行内 `[ Select(国家) flex:1 ][ Button 「查询」 auto ]`。`ToolPanel` 不再传 `action`。

## 三、GoogleTrendsTool

文件:`entrypoints/sidepanel/pages/GoogleTrendsTool.tsx`

| 项 | 现状 | 改为 |
|---|---|---|
| subtitle | `谷歌趋势` | 删除(不传 subtitle) |
| 「天数」「地区」「对比词」三个标签 | 有 | 全部删除 |
| 对比词位置 | 在天/地区上方 | 移到天/地区**下方** |
| 搜索按钮位置 | header `action` | 下放到对比词行 |

新布局:

- 第 1 行:天数 `Select`(flex 1) + 地区 `Select`(flex 1),无标签
- 第 2 行:对比词 `Combobox`(flex 1) + 「搜索」`Button`(auto),无标签

## 四、QuickSearchTool → 「搜索引擎查询」

文件:`entrypoints/sidepanel/pages/QuickSearchTool.tsx`

| 项 | 现状 | 改为 |
|---|---|---|
| title | `快捷搜索` | `搜索引擎查询` |
| header logo | `GoogleLogo` | 新 logo(本地,`bing.net` 缩略图下载 → `quick-search.png`) |
| geo 标签 | `位置(仅 Google)` | `搜索定位` |
| Google 按钮位置 | 左列,geo 下沉到 Google 上方 | geo Select 与 Google Button **同一行** |
| Yandex | 无 | 新增 |

新布局:

```
┌───────────────────────────────────┐
│ [ 搜索定位 Select ][ Google 按钮 ]  │  第 1 行
├───────────────────────────────────┤  ← 分割线(左右 margin,首尾不贯穿)
│ [ Bing 按钮 ][ Yandex 按钮 ]        │  第 2 行(Bing 在前)
└───────────────────────────────────┘
```

- 分割线:`border-top: 1px solid var(--color-border); margin: var(--space-sm) 0;`(或左右各留 padding),**不贯穿**卡片左右边缘。
- Yandex:
  - `buildYandexSearchUrl(kw)` → `https://yandex.com/search/?text=${encodeURIComponent(kw)}`,放 `lib/quicksearch/url.ts`。
  - `YandexLogo` 组件,`brand-logos.tsx` 新增,本地 `yandex.png`。
- geo 仍只作用于 Google(`lib/quicksearch/geo.ts` 不变)。

## 五、logo 资源清单

下载到 `entrypoints/sidepanel/assets/logos/`:

| 文件 | 来源 url |
|---|---|
| `backlink-checker.svg` | `https://seo.box/static/img/backlink-checker.svg` |
| `website-authority-checker.svg` | `https://seo.box/static/img/website-authority-checker.svg` |
| `keyword-difficulty-checker.svg` | `https://seo.box/static/img/keyword-difficulty-checker.svg` |
| `google-analytics.svg` | `https://seo.box/static/img/google_analytics.svg` |
| `clarity.svg` | `https://seo.box/static/img/clarity.svg` |
| `pagespeed.svg` | `https://seo.box/static/img/pagespeed.svg` |
| `google-search-console.png` | `https://ts2.tc.mm.bing.net/th/id/OIP-C.2ejl-ESSjv6SQlYx8yFjMgHaHa?...`(GSC) |
| `quick-search.png` | `https://ts1.tc.mm.bing.net/th/id/OIP-C.L83RAs_rGRGaX3BxmY2S-wHaDt?...`(QuickSearch header) |
| `yandex.png` | `https://ts2.tc.mm.bing.net/th/id/OIP-C._Gf94XN6zoQxQ-Mrer8HgwHaI8?...`(Yandex) |

`brand-logos.tsx` 新增/调整导出:`BacklinkCheckerLogo` / `WebsiteAuthorityCheckerLogo` / `GoogleSearchConsoleLogo` / `GoogleAnalyticsLogo` / `ClarityLogo` / `PageSpeedLogo` / `YandexLogo`,并把 `AhrefsLogo` 的 import 指向 `keyword-difficulty-checker.svg`、`QuickSearchTool` 的 header logo 指向 `quick-search.png`。

**降级风险**:`bing.net/th/id/OIP-C.*` 缩略图在自动化环境可能抓不到或日后失效。若抓取失败:先告知用户,用占位 SVG 顶替并加 `TODO` 注释,等用户手动替换;`seo.box` 资源同理若失败则告知。

## 六、测试策略

更新(同步文案/布局断言):

- `tests/sitetools.test.tsx` — 网站提交 + 8 工具网格,各工具点击打开正确 url
- `tests/toolcard.test.tsx` — 新增 `logo` prop 用例
- `tests/ahrefs-tool.test.tsx` — subtitle=`Keyword Difficulty Checker`、无「国家」、按钮文案「查询」、按钮与 Select 同行
- `tests/google-trends-tool.test.tsx` — 无「谷歌趋势」、无「天数/地区/对比词」标题、搜索按钮在对比词行
- `tests/quick-search-tool.test.tsx` — title「搜索引擎查询」、「搜索定位」、Yandex 按钮 + url 含 `text=`、分割线存在
- `tests/brand-logos.test.tsx` — 新增 logo 组件渲染为 `<img>`

新增:

- `tests/site-tools-url.test.ts` — `buildBacklinkCheckerUrl` / `buildWebsiteAuthorityCheckerUrl` 单测(含 origin 规范化、mode 固定)
- `tests/quicksearch-url.test.ts` — 追加 `buildYandexSearchUrl` 用例

## 七、实施顺序

1. 建分支 `feat/site-kw-tools-expansion`。
2. 下载 logo 资源(9 个),更新 `brand-logos.tsx`。
3. 网站工具:`lib/site-tools/url.ts` + `tools.ts` + `ToolCard` 加 `logo` + `SiteTools.tsx` 重构 + 测试。
4. AhrefsTool:UI 改造 + 测试。
5. GoogleTrendsTool:UI 改造 + 测试。
6. QuickSearchTool:UI 改造 + Yandex + 分割线 + 测试。
7. `pnpm test` 全绿 + `pnpm typecheck`。
8. 分阶段 commit(每个工具一个 commit,或网站工具/三个关键词工具分组)。

## 八、风险与待决

### 8.1 直接打开类工具是否依赖 site

GSC/GA/Clarity/PageSpeed 不需要 domain 即可打开。是否在无 site 时也允许点击?

- **推荐**:仍受 `hasSite` 控制,与 robots/sitemap/网站提交一致(整个网站工具 tab 都围绕「当前站点」),避免用户在未选站点时误点开分析平台首页。
- 实施时按此默认;若用户 review 时异议,改成 direct 类不依赖 site。

### 8.2 bing.net 缩略图稳定性

见 §5 降级方案。

### 8.3 ToolCard `logo` prop 向后兼容

robots/sitemap 继续走 `icon` 分支,确保不受 `logo` 改动影响(`toolcard.test.tsx` 需覆盖两种路径)。
