# Bing Webmaster URL Inspection 真实页面 CDP 探测笔记

> 状态：**VERIFIED（2026-06-28）**。在已连通的 Edge 上跑通了真实 Bing URL Inspection + Request indexing
> 全流程（inspect → 判定 → Request indexing → Submit → 成功提示），所有 PROBES 已对照真实 DOM 校验，
> 两种可提交态、确认弹窗、成功文案均已记录。Bing flow 可直接照搬本文件。

## 0. 探测结论：DONE — 真实流程已跑通

- 环境：web-access CDP proxy（`http://localhost:3456`）→ 本机 Edge（9222）。
- 被驱动的 Edge 已登录拥有 `bottleneck-checker.com` 的 Microsoft / Bing Webmaster 账号（用户名「裕曾」）。
- 实测 URL：
  - `https://bottleneck-checker.com`（**已索引**）：sections = `["Indexed successfully", "2 SEO/GEO issues found", "No Markup found"]`。
  - `https://bottleneck-checker.com/de/`（**未提交**）：sections = `["Not discovered", ...]`，
    走完整 Request indexing → Submit 流程，提交后出现 `<span role="alert">Indexing requested.</span>`。
- 完整跑通：打开页面 → 填 URL → **点击 Inspect 按钮** → 等 "Getting status from Bing Index" 弹窗自动关闭 →
  结果区出现 → 判定（已索引→跳过 / 否则→提交）→ 点击 Request indexing → 确认弹窗 → 点击 Submit →
  弹窗自动关闭 + "Indexing requested." → 清空输入框 → 下一条。

### 与 GSC 的关键差异（实现 Bing flow 时务必注意）

| 维度 | GSC | Bing |
|---|---|---|
| 触发 inspect | **回车**（无放大镜按钮） | **点击 Inspect 按钮**（`[data-tag=inspectBtn]`） |
| 按钮元素类型 | `DIV[role=button]`（无 disabled 属性） | 真 `<button>`（有 `disabled` 属性） |
| 稳定锚点 | `aria-label` / `role`（Google class 是动态 hash） | **`data-tag`**（Bing 的 data-tag 稳定，id 是动态 `TextField+N`） |
| 提交步骤 | **单按钮**（点一次自动完成） | **两步**：Request indexing → 确认弹窗 → Submit |
| 可提交态文案 | 「网址尚未收录到 Google」 | **两种**：「Not discovered」/「Discovered but not crawled」，都显示 Request indexing |
| 成功信号 | snackbar「已请求编入索引」 | `<span role="alert">Indexing requested.</span>` |
| 配额机制 | 全账号连续配额（~10/月/URL） | **每天配额**（确认弹窗显示 "Quota left for today : N URLs"） |

---

## 1. CDP proxy 运维发现（与 GSC 一致，Task 实现会用到）

| 现象 | 说明 | 对策 |
|---|---|---|
| `/new` 创建的后台 tab 可能停在 about:blank | Edge 对 `Target.createTarget` 不立即导航 | 以 `eval location.href` 为准 |
| `/navigate`/`/new` 的 waitForLoad 对重 SPA 不可靠 | Bing Webmaster 是 SPA，load 事件晚 | **忽略**其超时，改用轮询 `/eval` 判就绪 |
| 跨页导航后 `Runtime.evaluate` 可能短暂超时 | 导航中旧 context 销毁 | 导航后**先 sleep 3–6s** 再首次 eval |
| `id="TextField107"` 不可靠 | id 是动态 `TextField+N`（本次为 `TextField60`） | **用 `[data-tag=urlInspectionInput]`**，不要用 id |

**推荐「打开 Bing URL Inspection」子流程**：
```
1. POST /new  body=`https://www.bing.com/webmasters/urlinspection?siteUrl={siteUrl}`  -> targetId T
2. （导航后 sleep 3–6s）
3. 轮询（每 1s，最多 ~30s）：
     POST /eval?target=T  -> JSON.stringify({u:location.href, hasInput:!!document.querySelector('[data-tag=urlInspectionInput]')})
   直到 u 以 https://www.bing.com/webmasters/urlinspection 开头 且 hasInput===true
4. 进入 URL 检查流程
```

---

## 2. 已验证的 PROBES（Bing flow 直接照搬）

> Bing 用 **`data-tag`** 作为稳定锚点（实测 id 动态、class 含动态 hash 后缀如 `field-189`/`root-198`，
> 但 data-tag 与语义 class `urlInspectionSectionTitle` 稳定）。下面所有表达式优先用 data-tag，
> 文案判定用 `document.body.innerText` 正则（与 GSC 一致，对中英文兼容）。

### 2.1 `inspectInput` — 顶部 URL 检查输入框  ✅ 已验证
```js
document.querySelector('[data-tag="urlInspectionInput"]')
```
- ✅ 真实元素：`<input type="text" data-tag="urlInspectionInput">`，id 动态（本次 `TextField60`，**不是** 用户 HTML 片段里的 `TextField107`）。
- ✅ `aria-label` = `Enter URL to inspect in "https://bottleneck-checker.com/"`（含 siteUrl，可用作 fallback）。
- ✅ `placeholder` 同 aria-label；class 含 `ms-TextField-field urlInspectionInput field-189`（`field-189` 动态）。
- 等待条件：`document.querySelector('[data-tag=urlInspectionInput]')` 存在 且 `location.href` 含 `urlinspection`。

### 2.2 填值  ✅ 已验证（native setter，React 受控组件）
```js
const i = <inspectInput>;
i.focus();
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(i, TARGET_URL);          // 必须 native setter —— ms-TextField 是 React 受控组件，直接 i.value= 会被覆盖
i.dispatchEvent(new Event('input', { bubbles: true }));
```
- ✅ 实测：setter + `input` 事件后 `i.value` 即为目标 URL，React state 已更新。
- **关键差异**：填值后**不派发回车**，而是**点击 Inspect 按钮**（见 2.3）。Bing 的检查由按钮触发，回车不触发。

### 2.3 `inspectBtn` — 「Inspect」按钮  ✅ 已验证
```js
document.querySelector('[data-tag="inspectBtn"]')
```
- ✅ 元素类型：**真 `<button type="button">`**（class `ms-Button ms-Button--primary inspectBtn root-198`），`aria-label="Inspect"`。
- ✅ `disabled` 属性真实存在（inspect 进行中可能为 true；空闲时 false）。
- 点击方式：**页面内 `el.click()`**（与 GSC 一致：chrome.debugger 后台 tab `active:false` 下 `Input.dispatchMouseEvent` 不触发框架点击，`el.click()` 是 Runtime.evaluate 里的纯 DOM 调用，可靠）。

### 2.4 结果区判定（已索引 / 可提交两态）  ✅ 已验证

检查结果出现在 `.urlInspectionSectionTitle`（语义 class，稳定）元素里。点击 Inspect 后先弹
「Getting status from Bing Index」进度弹窗（自定义组件，非 role=dialog），数秒后自动关闭、结果区填充。

**等结果就绪信号**（替代 GSC 的「按钮/文案任一命中」）：
```js
document.querySelectorAll('.urlInspectionSectionTitle').length > 0
```
- ✅ getting 期间 sections 为空；结果出来后 sections 非空。实测 ~5–15s。

**已索引判定**（跳过提交）：
```js
/indexed successfully/i.test(document.body.innerText)
```
- ✅ 已索引 `https://bottleneck-checker.com`：sections 首项 = **「Indexed successfully」**。
- ⚠️ **已索引页同样显示 Request indexing 按钮**（与 GSC 同坑！）。已索引态 sections 头部还会出现
  `urlInspectionIndexingHeader` 文案「Page updated?Request indexing」。**判定已索引只看 "Indexed successfully" 文案，不能看按钮缺失**。

**可提交两态**（都显示 Request indexing 按钮，都点击提交）：
- 「**Discovered but not crawled**」：Bing 已发现 URL 但未抓取（用户描述的态，本次未直接命中该 URL，但同按钮同流程）。
- 「**Not discovered**」：Bing 完全未发现该 URL。本次 `/de/` 即此态，sections 首项 = **「Not discovered」**，详情「The inspected URL is not known to Bing.」。

> 因此 Bing flow 的分类逻辑：**先判 isAlreadyIndexed（命中→跳过）；否则视为可提交**（不区分两种可提交态文案，
> 只要 Request indexing 按钮存在且未禁用即提交）。比 GSC 更简单——无需「不属于此域名」分支（siteUrl 已锁定资源）。

### 2.5 `requestIndexingButton` — 「Request indexing」按钮  ✅ 已验证
```js
document.querySelector('[data-tag="requestIndexingButton"]')
```
- ✅ 元素类型：**真 `<button>`**，`aria-label="Request indexing"`，文本「Request indexing」。
- ✅ 两态（已索引 / 未发现）均出现此按钮；未禁用时 `disabled=false`、`aria-disabled=null`。
- 点击：页面内 `el.click()` → 弹出确认弹窗（见 2.6）。

### 2.6 `submitBtn` + 确认弹窗  ✅ 已验证
点击 Request indexing 后出现 `role="dialog"` 确认弹窗（注意：之前 Getting status 的弹窗**不是** role=dialog，这个确认弹窗**是**）：
```
Request indexing
Are you sure you want to submit following URL for indexing?
https://bottleneck-checker.com/de/
Quota left for today : 99 URLs
[Cancel] [Submit]
```
- ✅ `submitBtn`：`document.querySelector('[data-tag="submitBtn"]')` → 真 `<button aria-label="Submit">`，文本「Submit」。
- ✅ 确认弹窗 selector：`[role=dialog]` 且文本含 `are you sure|submit following`。
- **配额信息**：弹窗内「Quota left for today : N URLs」是 Bing 的**每日配额**。配额耗尽（N=0）时 Submit 可能 disabled 或提交报错（本次未触发，保留兜底）。
- **等待信号（flow 实现注记，2026-06-28 修复 Submit 未点击）**：实测 submitBtn 在主文档可查
  （诊断 directFound=true、ownerDoc=main、无 shadow/iframe），但 chrome.debugger 后台 tab 下
  `querySelector('[data-tag=submitBtn]')` 命中偶发滞后，导致原 ⑧ 以 submitBtn 为信号时 15s 超时、
  Submit 未被点击（用户反馈）。修复：⑧ 改以 **`role=dialog`（含「Are you sure」）为就绪信号**
  （`confirmDialog`，比 submitBtn 更早、更稳），⑨ 改用**多策略定位 Submit**（`data-tag` → 弹窗内
  aria-label/文本 Submit → shadow 深度穿透）+ CONFIRM_TIMEOUT 提到 30s。端到端复测（2026-06-28）：
  `confirmDialog=true` → `submitAction={found:true,disabled:false,clicked:true}` → `indexingRequested=true`。
  失败时 reason 带 `(dialog=N,submit=N,deep=N)` 诊断计数，runBatch 每条结果上 onLog。

### 2.7 `successIndicator` — 提交成功提示  ✅ 已验证（核心）
```js
/indexing requested/i.test(document.body.innerText)
```
- ✅ **真实成功元素**：`<span role="alert">Indexing requested.</span>`（标准 role=alert）。
  宿主 div：`urlInspectionStatusHeaderContainer` / `urlInspectionIndexingHeader`（文本「Indexing requested.Request indexing」）。
- ✅ 点 Submit 后确认弹窗**自动关闭**，随即出现该 role=alert。
- **残留验证（重要）**：提交成功后清空输入框、inspect 下一个 URL，结果区刷新，「Indexing requested.」**被清除**（`indexingRequested:false`、`alertSpans:[]`）。
  → 下一条 submit 轮询不会误命中上一次残留。flow 只需在 submit **之后**轮询 successIndicator。
- flow：点 Submit 后轮询（每 ~3s，最多 ~60s）`/indexing requested/i` 命中即成功；超时未出现且 body 含 quota/exceeded 类文案→判配额。

### 2.8 `resetInput` — 清空输入框（回到可输入态）  ✅ 已验证
```js
const i = <inspectInput>;
i.focus();
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(i, '');
i.dispatchEvent(new Event('input', { bubbles: true }));
```
- ✅ 实测：清空后可直接填下一个 URL + 点 Inspect，结果区随之刷新，流程可循环。
- 备选：Bing 有专门的清空按钮 `[data-tag="urlInspectionClearInput"]`，亦可点击；native setter 更可控（与 GSC 一致）。

---

## 3. 登录态 / 权限态识别（前置检查）

打开 Bing URL Inspection URL 后、做任何操作前，先 eval：
```js
JSON.stringify({
  url: location.href,                 // 期望 https://www.bing.com/webmasters/urlinspection?siteUrl=...
  title: document.title,              // 期望 "URL Inspection - Bing Webmaster Tools"
  hasInspectInput: !!document.querySelector('[data-tag=urlInspectionInput]'),
  isLoginScreen: /login|signin|account\.live\.com|identity/i.test(location.href)
})
```
- ✅ healthy：`url` 以 `https://www.bing.com/webmasters/urlinspection` 开头、`title` 为「URL Inspection - Bing Webmaster Tools」、`hasInspectInput===true`。
- `isLoginScreen===true` → BLOCKED：未登录，提示用户登录 Microsoft / Bing Webmaster。
- Bing 的 siteUrl 资源权限由 URL 参数锁定：若账号无该站点，页面会显示空/错误态（`hasInspectInput` 仍可能为 true）。
  v1 不额外探测权限态，依赖用户在下拉框选对已验证站点。

---

## 4. 本次实际执行的探测记录（备查）

| # | 操作 | 结果 |
|---|---|---|
| 1 | `POST /new` Bing URL（siteUrl=bottleneck-checker.com/） | targetId，tab 正常导航 ✔ 已登录（用户名「裕曾」） |
| 2 | 探测输入框 | `[data-tag=urlInspectionInput]` 命中，id=`TextField60`（**非** TextField107） ✔ |
| 3 | native setter 填 `bottleneck-checker.com` + 点 inspectBtn | getting 状态出现 ✔ |
| 4 | 轮询 ~12s | sections=`["Indexed successfully",...]` ✔ 已索引态 |
| 5 | 清空 + 填 `/de/` + 点 inspectBtn | sections=`["Not discovered",...]` ✔ 未发现态，按钮可点 |
| 6 | 点 requestIndexingButton | 弹 `role=dialog` 确认弹窗「Are you sure...Quota left:99」+ submitBtn ✔ |
| 7 | 点 submitBtn | 弹窗自动关闭，`<span role=alert>Indexing requested.</span>` 出现 ✔ |
| 8 | 清空 + 重新 inspect `bottleneck-checker.com` | sections=`["Indexed successfully",...]`，`indexingRequested:false` ✔ 无残留 |
| 9 | `GET /close` | ✔ 关闭 |

**结论**：Bing flow 的 PROBES 全部对照真实 DOM 验证。两步按钮流程（Request indexing → Submit）+ 每日配额弹窗 + role=alert 成功提示均已观察清楚。
