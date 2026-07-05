# Sitemap 低价值链接过滤：账号 / 法务 / 用户中心类自动剔除

- **日期**：2026-07-05
- **状态**：已确认（待实现）
- **主题**：sitemap-lowvalue-filter

## 背景与目标

「网站提交」面板（`SubmitPanel.tsx`）在 `2026-07-04-sitemap-batch-submit` 改造后，流程为：抓取 sitemap → `mergeDiscovered` 增量入库 → 从未提交池随机选 10 个 → 提交至 GSC / Bing。

抓到的链接里常混有一批「提交无意义」的页面：登录、注册、登出、隐私协议、服务条款、用户中心、购物车、结算页等。这些页面：

1. **无 SEO 价值**：搜索引擎不应索引登录态/法务/账号页，主动提交浪费配额。
2. **挤占候选名额**：每批固定 10 个，被低价值链接占用后，真正的内容页反而少提交。
3. **用户无感知**：当前面板没有任何「会过滤哪些」的说明，用户不知道候选池已被如何处理。

**目标**：在 sitemap 抓取后、候选池构建前，用**正则**自动过滤账号认证 / 法务条款 / 用户中心三类低价值链接；过滤不污染本地全量链接库（`discovered` 仍保全量，仅不进候选池）；面板常驻过滤规则说明，提交后在系统日志回显本次过滤条数。

## 已确认的关键决策

经澄清确认，以下为本次改造的定调决策：

1. **过滤范围（三类）**：
   - **账号认证**：login / signin / sign-in / signup / logout / register / auth 等。
   - **法务条款**：privacy / policy / terms / agreement / disclaimer / legal / cookie / gdpr 等。
   - **用户中心**：account / profile / dashboard / settings / member / cart / checkout / order 等，以及 `my-*` 前缀。
   - **不含搜索 / 分页类**（`/search?` `/tag/` `/page/2`）——明确排除。
2. **入库语义**：`discovered` 库保留**全量**同 host 链接不变；过滤只作用于「提交候选池」。这样「查询进度」面板的 `syncDiscovered` 全量对账不受影响，且规则可逆（将来调整不影响已入库数据）。
3. **匹配方式**：正则表达式（用户明确要求），导出为静态常量 `LOW_VALUE_URL_RE`。
4. **匹配粒度**：**路径段精确匹配**（非子串包含），避免 `/blog/login-tips` 这类内容页被误伤。按类别分两个严格度（见下）。
5. **过滤发生位置**：在 `useSubmitOrchestrator` 第 ② 步（`mergeDiscovered` 全量入库）之后、第 ③ 步（候选池构建）之前——对 `discovered.urls`（累积并集）过滤，而非对单次 `fetched.urls` 过滤，保证多次提交口径一致。
6. **UI 提示**：sitemap 输入框下方**常驻说明**（事前告知规则）+ 提交后系统日志追加**本次过滤 N 条**（事后反馈数量）。不做被过滤 URL 列表展开。
7. **规则不可配置**：v1 固定内置常量（YAGNI），与 `BATCH_SIZE = 10` 同范式。

## 匹配粒度设计（核心正确性决策）

对完整 URL（小写后）整体应用一条组合正则。难点：`-` 既是误伤源（`login-tips` 是内容页）又是合法组合（`privacy-policy`、`terms-of-service` 是法务页）。解法——**按类别分两个严格度**：

| 类别 | 后边界要求 | 理由 | 命中示例 |
|---|---|---|---|
| 账号认证 / 用户中心（STRICT） | 段尾：`$` `/` `?` `#`，**不含 `-`** | `login-tips`、`register-guide`、`account-faq` 通常是内容页，不能误伤 | `/login` ✅ `/auth/login` ✅ `/blog/login-tips` ❌ |
| 法务条款（LOOSE） | 段首关键词即可，**允许 `-` 后缀** | `privacy-policy`、`terms-of-service`、`cookie-statement` 仍是法务页 | `/privacy-policy` ✅ `/terms-of-use` ✅ |
| `my-` / `my_` 前缀 | 前缀匹配，后跟任意 | 用户中心入口习惯以 `my-` 开头（`my-account` `my-orders`） | `/my-account` ✅ |

前边界统一为 `(?:^|/)`（串首或 `/`）——只认路径段边界，使 `/search?q=login` 中 `?q=login` 的 `login` 前面是 `=` 而非 `/`，不误伤。

### 完整正则

```js
// 严格段（账号认证 + 用户中心）：整段精确，后边界 $/?# 不含 -
const STRICT = [
  // 账号认证
  'login', 'sign[-_]?in', 'sign[-_]?up', 'log[-_]?out', 'log[-_]?off',
  'register', 'registration', 'auth',
  // 用户中心
  'account', 'accounts', 'profile', 'profiles', 'dashboard',
  'settings', 'setting', 'member', 'members',
  'cart', 'carts', 'checkout', 'order', 'orders',
].join('|');

// 宽松段（法务条款）：段首关键词，后可接 -
const LOOSE = [
  'privacy', 'polic(?:y|ies)', 'terms', 'tos',
  'agreement', 'agreements', 'disclaimer', 'disclaimers',
  'legal', 'cookie', 'cookies', 'gdpr',
].join('|');

export const LOW_VALUE_URL_RE = new RegExp(
  '(?:^|/)(?:' +
    'my[-_]' +                              // ① my- / my_ 前缀（用户中心入口）
    '|' + '(?:' + LOOSE + ')(?=$|[/?#-])' + // ② 法务：段首关键词，允许 - 后缀
    '|' + '(?:' + STRICT + ')(?=$|[/?#])'   // ③ 账号/用户中心：整段（防 login-tips 误伤）
  + ')',
  'i',
);
```

### 误伤验证表（关键测试用例）

| URL | 预期 | 命中分支 |
|---|---|---|
| `https://x.com/login` | 过滤 | ③ |
| `https://x.com/auth/login?next=/home` | 过滤 | ③ |
| `https://x.com/sign-in` | 过滤 | ③（`sign[-_]?in`） |
| `https://x.com/blog/login-tips-for-beginners` | **保留** | ③ 不中（login 后是 `-`），无其他命中 |
| `https://x.com/privacy-policy` | 过滤 | ② |
| `https://x.com/terms-of-service` | 过滤 | ② |
| `https://x.com/cookie-statement` | 过滤 | ② |
| `https://x.com/my-account/orders` | 过滤 | ① |
| `https://x.com/blog/why-gdpr-matters` | 过滤 | ②（gdpr 段首，可接受边界） |
| `https://x.com/search?q=login` | **保留** | `?q=login` 中 login 前是 `=` |
| `https://x.com/legal` | 过滤 | ② |
| `https://x.com/account-faq` | **保留** | ③ 不中（account 后是 `-`），无其他命中 |

> **边界妥协**：`/blog/why-gdpr-matters` 这类含法务关键词的博文会被误伤——极少见，v1 接受。若后续发现误伤面扩大，可把法务类改回严格（代价：漏掉 `privacy-policy` 这类组合路径）。

## 架构与数据流

```
SubmitPanel（UI）
  └─ useSubmitOrchestrator.run({ gsc, bing }, domain, sitemapUrl)
       ① port → background: SITEMAP_FETCH → 收 urls[]
       ② mergeDiscovered(domain, sitemapUrl, urls)        // 全量入库（不变）
       ②.5 { kept, dropped } = partitionLowValue(discovered.urls)   // 新增：纯函数过滤
            if (dropped.length) pushLog('info','system',
              `已过滤 ${dropped.length} 条低价值链接（登录/注册/隐私/条款/账号等）`)
       ③ pool = kept.filter(u => 勾选平台.every(p => !okSet.has(`${p}|${u}`)))   // 用 kept 替代 discovered.urls
       ④ picked = pickRandom(pool, 10)
       ⑤~⑧ batchId / gsc.start / bing.start / appendSubmissions / 报告（不变）
```

**不动**：`lib/sitemap/*`（fetch / parse / handler）、`lib/storage/discovered.ts`、background、`lib/gsc/*` / `lib/bing/*`、「查询进度」面板、`pick.ts`、`reasons.ts`。

## 组件结构

```
lib/submit/filter.ts（新增）
├─ LOW_VALUE_URL_RE            // 静态正则常量
├─ isLowValueUrl(url): boolean
└─ partitionLowValue(urls): { kept, dropped }   // 单次遍历，保序

useSubmitOrchestrator.ts（改造）
└─ run() 第 ②.5 步：过滤 + 日志；第 ③ 步候选池用 kept

SubmitPanel.tsx（改造）
└─ sitemap TextInput 下方常驻说明行
```

## 模块接口

### `lib/submit/filter.ts`（新增）

```ts
/** 低价值链接匹配正则（账号认证 / 法务条款 / 用户中心三类，路径段精确匹配） */
export const LOW_VALUE_URL_RE: RegExp;

/** 单条 URL 是否为低价值（不参与提交候选） */
export function isLowValueUrl(url: string): boolean;

/**
 * 把 URL 列表拆为「保留候选」与「被过滤」两段。保序、不去重。
 * 单次遍历 O(n)。被调用方负责在 dropped.length > 0 时上报日志。
 */
export function partitionLowValue(urls: string[]): { kept: string[]; dropped: string[] };
```

实现约束：

- `isLowValueUrl = (url) => LOW_VALUE_URL_RE.test(url)`。
- `partitionLowValue` 用一次 `for` 循环按 `isLowValueUrl` 分桶；不修改入参，返回两个新数组。
- 纯函数、无 IO、无 `Date.now` / `Math.random`，SW 与 document 均可调用。

### `useSubmitOrchestrator.ts`（改造，第 ②.5 / ③ 步）

```ts
// ② 增量合并入库（不变）
const discovered = await mergeDiscovered(domain, sitemapUrl, fetched.urls);

// ②.5 低价值过滤（新增）
const { kept, dropped } = partitionLowValue(discovered.urls);
if (dropped.length > 0) {
  pushLog('info', 'system', `已过滤 ${dropped.length} 条低价值链接（登录/注册/隐私/条款/账号等）`);
}

// ③ 候选池（用 kept 替代原 discovered.urls）
const subs = await getSubmissions(domain);
const okSet = new Set(subs.filter((r) => r.status === 'ok').map((r) => `${r.platform}|${r.url}`));
const pool = kept.filter((u) => selected.every((p) => !okSet.has(`${p}|${u}`)));
```

> 日志仅 `dropped.length > 0` 时输出，避免每次提交都刷一条空提示。

## UI 规格（SubmitPanel）

### 常驻说明（新增）

在 sitemap `<TextInput>` 正下方、`error` 提示位之上，插入一行 11px 灰字说明：

```tsx
<div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
  将自动过滤登录 / 注册 / 隐私 / 条款 / 账号等低价值链接，不参与提交。
</div>
```

### 提交后计数（复用现有 LogPanel）

由 orchestrator 的 `pushLog('info', 'system', …)` 产出，落入现有「▍系统」`LogPanel`，与 `发现 N 条链接` `候选 N，本批选中 N` 同区呈现，不新增组件。

期望日志序列（典型一次提交）：

```
抓取 sitemap: https://example.com/sitemap.xml
发现 234 条链接（深度 1）
已过滤 18 条低价值链接（登录/注册/隐私/条款/账号等）   ← 新增
候选 12，本批选中 10
…
```

## 错误处理与边界

| 场景 | 行为 |
|---|---|
| 过滤后候选池为空（但 dropped > 0） | 沿用现有 `pool.length === 0` 分支：info「无可提交链接，全部已提交」+ return；用户能从上一条「已过滤 N 条」看出是过滤导致 |
| 整批全被过滤（kept 为空） | 同上：先输出「已过滤 N 条」再输出「无可提交链接」 |
| sitemap 抓取失败 | 过滤逻辑根本不执行（前置 return） |
| URL 不规范 / 解析异常 | `RE.test(url)` 即使 URL 怪异也只返回 false，不抛错；该 URL 进 kept |
| discovered 历史数据（无 filter 字段） | 无需迁移——过滤是运行时纯计算，不依赖存储字段 |
| 跨会话累积 discovered | 过滤对累积并集生效，每次提交口径一致 |

## 测试策略（vitest + TDD，对齐 `tests/` 范式）

### 新增 `tests/submit-filter.test.ts`

| 用例 | 断言 |
|---|---|
| 账号认证命中 | `login` `auth/login` `sign-in` `logout` 各过滤 |
| 法务命中（含组合） | `privacy-policy` `terms-of-service` `cookie-statement` 过滤 |
| 用户中心命中 | `account` `dashboard` `cart` `checkout` 过滤 |
| `my-` 前缀命中 | `my-account` `my-orders` 过滤 |
| 误伤防护（STRICT） | `blog/login-tips` `account-faq` `register-guide` **保留** |
| 误伤防护（query） | `search?q=login` **保留** |
| 大小写 | `LOGIN` `Privacy-Policy` `MY-Account` 命中 |
| 段边界 | `/login` `/login?next=/` `/login#section` 命中；`/loginator` **保留**（后跟字母，非段尾） |
| `partitionLowValue` | 混合列表正确拆分、保序、不去重 |
| 边界 | 空列表 → `{ kept: [], dropped: [] }`；全保留；全过滤 |

### 增补 `tests/useSubmitOrchestrator.test.tsx`

mock sitemap port 返回含低价值链接的列表（如 `[.../login, .../privacy-policy, .../blog/post-1]`），断言：

1. `mergeDiscovered` 收到的是**全量**（含低价值项，未被提前过滤）——验证入库语义不变。
2. 系统 logs 含 `已过滤 2 条低价值链接` 字样。
3. 候选池（传给 `pickRandom`）不含 `/login` `/privacy-policy`。
4. dropped.length === 0 时**不**输出过滤日志（空 case）。

`chrome.storage.local` 沿用现有测试的 fake 实现。

## 改动文件清单

| 文件 | 动作 | 说明 |
|---|---|---|
| `lib/submit/filter.ts` | 新增 | `LOW_VALUE_URL_RE` / `isLowValueUrl` / `partitionLowValue` 纯函数 |
| `entrypoints/sidepanel/hooks/useSubmitOrchestrator.ts` | 改造 | 第 ②.5 步插入过滤 + 条件日志；第 ③ 步候选池用 `kept` |
| `entrypoints/sidepanel/pages/SubmitPanel.tsx` | 改造 | sitemap 输入框下方常驻说明 |
| `tests/submit-filter.test.ts` | 新增 | 纯函数三类命中 + 误伤防护 + 边界 |
| `tests/useSubmitOrchestrator.test.tsx` | 增补 | 过滤接入断言（全量入库 / 日志 / 候选池） |

**不改动**：`lib/sitemap/*`、`lib/storage/*`、`entrypoints/background.ts`、`lib/gsc/*`、`lib/bing/*`、查询进度面板、`pick.ts`、`reasons.ts`、`wxt.config.ts`（无新权限）。

## 范围与非目标（YAGNI）

v1 不做：

- 规则可配置 UI / 用户自定义正则。
- 被过滤 URL 列表展开查看（仅计数）。
- 过滤规则按站点覆盖（多站点不同规则）。
- 搜索 / 分页类过滤（`/search?` `/tag/` `/page/N`）——明确排除。
- 把 `LOW_VALUE_URL_RE` 暴露到 UI 供展示（文案硬编码）。
- discovered 库给 URL 打 `lowValue` 标记（运行时计算足够，避免存储结构变更与迁移）。
