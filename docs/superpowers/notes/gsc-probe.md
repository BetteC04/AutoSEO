# GSC 真实页面 CDP 探测笔记（Task 10）

> 状态：**VERIFIED（2026-06-28）**。在已连通 VPN 的 Edge 上跑通了真实 GSC URL 检查 + 请求编入索引
> 全流程，所有 PROBES 已对照真实 DOM 校验，弹窗 / 成功提示文案均已记录。Task 11 可直接照搬本文件。

## 0. 探测结论：DONE — 真实流程已跑通

- 环境：web-access CDP proxy（`http://localhost:3456`）→ 本机 Edge（9222）。
  VPN 已生效，`search.google.com` 可达（不再 `ERR_TIMED_OUT`）。
- 被驱动的 Edge 已登录拥有 `bottleneck-checker.com` 的 Google 账号，账号语言为**中文**（标题「概述」「网址检查」）。
- 初版测试 URL：`https://bottleneck-checker.com/es/`（当时**未被编入索引**，已完整跑通请求流程；该次提交成功后现已被 Google 收录）。
- 完整跑通：填 URL → 回车 → 检查结果加载 → 点击「请求编入索引」→ 实时测试弹窗 → 自动完成 → 成功 toast。
- 2026-06-28 复测：用 `bottleneck-checker.com` 资源下两个 URL 对照两态——
  `/es/`（已索引，标题「网址已收录到 Google」）、`/zh/`（未索引，标题「网址尚未收录到 Google」），
  据此修正了 §2.4「已索引页面按钮不出现」的错误推断（实测两态都显示按钮），并修正了 flow 的已索引判定。
- **重要运行事实**：GSC 请求编入索引是**单按钮流程**——点一次「请求编入索引」后会弹出
  「正在测试实际网址可否编入索引」的进度弹窗（含「取消」按钮），1-2 分钟后自动提交并显示成功 toast，
  **不需要**再点第二个「提交/同意」按钮。Task 12 的 flow 因此简化为：点按钮 → 轮询 success toast。

---

## 1. CDP proxy 运维发现（已验证，Task 11 会用到）

| 现象 | 说明 | 对策 |
|---|---|---|
| `/new` 创建的后台 tab 会在 `about:blank` 停顿 | Edge 对 `Target.createTarget` 不立即导航 | 创建后**显式 `/navigate` 或页内 `location.href=`**；以 `eval location.href` 为准 |
| `/navigate` 默认 15s `waitForLoad`，重 SPA 常超时 | proxy `waitForLoad` 轮询 `readyState==='complete'`，GSC load 事件晚 | **忽略 `/navigate` 的 timeout 报错**，改用轮询 `/eval` |
| 跨页导航后 `Runtime.evaluate` 可能短暂超时 | 导航中旧 context 销毁、新 context 未就绪 | 导航后**先 sleep 3–5s** 再首次 eval；遇超时重试一次 |
| `/targets` 元数据 URL ≠ 实际文档 URL | 元数据是「目标意图 URL」 | **以 `eval location.href` 为准**判断当前页 |
| `/health` 报 `connected:null` 但 proxy 仍可用 | override-source 浏览器配置下的显示怪癖 | **以 `/new` 能否返回 `targetId` 为准**，不要因 `connected:null` 判定失败 |

**推荐 Task 11 的「打开 GSC」子流程**：
```
1. POST /new  body=GSC_URL            -> targetId T
2. （可选）POST /navigate?target=T body=GSC_URL   （忽略可能 timeout）
3. 轮询（每 3s，最多 ~30s）：
     POST /eval?target=T  -> JSON.stringify({u:location.href,t:document.title,hasInput:!!document.querySelector('input')})
   直到 u 以 https://search.google.com 开头 且 hasInput===true
4. 进入 URL 检查流程
```

---

## 2. 已验证的 PROBES（Task 11 直接照搬）

> Google 的 class 名是动态 hash，**切勿依赖 class**。下面所有表达式都用
> `aria-label` / `role` / 可见文本匹配，且对中英文双语兼容。
> 观察值基于中文账号（GSC 实际文案见每条「✅ 真实文案」栏）。

### 2.1 `inspectInput` — 顶部「检查网址」输入框  ✅ 已验证
```js
[...document.querySelectorAll('input')].find(i =>
  /检查.*任何网址|inspect any/i.test(i.getAttribute('aria-label') || '')
)
```
- ✅ 真实 `aria-label`（中文）：**`检查 bottleneck-checker.com 中的任何网址`**
  （英文账号应为 `Inspect any URL in bottleneck-checker.com`）。
- `placeholder` 为空字符串；`type="text"`；无 `<form>` 外层。
- 等待条件：`document.querySelector('input')` 存在 且 `location.href` 含 `search-console`。

### 2.2 填值并提交  ✅ 已验证
```js
const i = <inspectInput>;
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(i, TARGET_URL);          // 必须 native setter —— React 受控组件，直接 i.value= 会被覆盖
i.dispatchEvent(new Event('input', { bubbles: true }));
i.focus();
i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
```
- ✅ 实测：回车后 URL 立刻变为
  `https://search.google.com/u/0/search-console/inspect?resource_id=sc-domain%3A...&id=<docId>`，
  标题变为「网址检查」。
- **关键**：必须用 `nativeInputValueSetter`（直接赋 `i.value=` 在 React 下不生效）。
- **不需要**找放大镜按钮 —— 回车即可触发。

### 2.3 `requestIndexingButton` — 「请求编入索引」按钮  ✅ 已验证
```js
[...document.querySelectorAll('[role=button]')].find(b =>
  /请求编入索引|request indexing/i.test((b.textContent || '').trim())
)
```
- ✅ 元素类型：**`DIV` + `role="button"`**（**不是** `<button>`！）→ selector 必须含 `[role=button]`。
- ✅ 文案（未提交时）：按钮整体文本为 **「请求编入索引再次提交请求」**
  （即「请求编入索引」主标签 + 「再次提交请求」副链接连在一起，需用正则子串匹配，勿用全等）。
- ✅ disabled 状态：**`aria-disabled="false"`**（已启用可直接点）。
  注意此元素**没有** `disabled` 属性（DIV 无该属性），判 disabled 只能读 `aria-disabled`。
- 等待条件：URL 进入 `/inspect` 后轮询按钮出现（实测检查结果 ~10-15s 出现）。
- ⚠️ **点击方式（2026-06-28 chrome.debugger 复测修订）**：用**页面内 `el.click()`**，**不要**用
  `Input.dispatchMouseEvent`。后者在 chrome.debugger **后台 tab**（`active:false`）下不触发 React
  点击（实测：命令成功返回但 Live Test 不弹，`[role=dialog]` 数不变）；`el.click()` 是 Runtime.evaluate
  里的纯 DOM 调用，不依赖渲染层，后台 tab 可靠（实测 `dialogs 5→6` 触发 Live Test）。probe 当时
  （web-access proxy）下 `Input.dispatchMouseEvent` 可用，但插件运行时（chrome.debugger）必须用 `el.click()`。

### 2.4 `isAlreadyIndexed` — URL 已被编入索引  ✅ 已验证（双向，2026-06-28 复测）
```js
/网址已收录到 Google|URL is on Google/i.test(document.body.innerText)
  && !/网址尚未收录到 Google|URL is not on Google/i.test(document.body.innerText)
```
- ✅ **两态均已实测**（2026-06-28 复测，`bottleneck-checker.com` 资源下）：
  - 已索引 `https://bottleneck-checker.com/es/`（初版那次提交后被 Google 收录）：
    标题文案 **「网址已收录到 Google」**，详情 **「网页已编入索引」**。
  - 未索引 `https://bottleneck-checker.com/zh/`：
    标题文案 **「网址尚未收录到 Google」**，详情「此网页未编入索引…」「网页未编入索引：Google 无法识别此网址」，
    另含干扰文案「仅已编入索引的网址有增强选项」（带「已编入索引」字样）。
- ⚠️ **关键修正（推翻初版推断）**：**已索引页面同样显示「请求编入索引」按钮**
  （DIV[role=button]，aria-disabled=false，文案「请求编入索引再次提交请求」）。
  **按钮存在性不能区分已索引/未索引**。
  - 初版（Task 10）只实测到未索引态，错误推断「已索引时按钮不出现」「按钮缺失=已索引信号」。
  - 因此 flow 的已索引判定**必须以状态文案为准**，**不能**叠加「按钮缺失」条件——
    否则已索引 URL 会跳过已索引分支、被误点击「请求编入索引」（这正是 2026-06-28 修复的 bug）。
- 正则只用标题级主文案精确匹配 + 反向排除，避免宽泛的「已编入索引」（未索引页干扰文案会命中）。

### 2.5 `isQuota` — 配额耗尽提示  ⚠️ 未触发（保留推断）
```js
/已达.*上限|配额|quota|try again later|稍后.*再试|无法.*更多/i.test(document.body.innerText)
```
- 本次请求成功，**未触发配额提示**。真实文案未能记录。
- 配额是 GSC 全账号每日上限（默认 ~10/月/URL，~200/天 全局），Task 12 仍需兜底匹配，
  若 `successIndicator` 未出现且匹配到 quota 类文案，判 `isQuota`。

### 2.6 `isNotOwned` — 当前账号无该资源权限  ✅ 已验证（未触发，保留兜底）
```js
/您没有.*权限|don't have (access|permission)|无权访问|verify that you own/i.test(document.body.innerText)
```
- 本次账号拥有资源，**未触发**。保留兜底（流程上理论上不会发生，URL 属于已选资源）。

### 2.7 `successIndicator` — 提交成功提示  ✅ 已验证（核心）
```js
/已请求编入索引|已将网址添加到优先抓取队列|requested|added to.*queue/i.test(document.body.innerText)
```
- ✅ **真实成功 toast 文案**（提交后约 1-2 分钟，自动出现）：
  > **✓ 已请求编入索引**
  > **已将网址添加到优先抓取队列中。 多次提交同一网页并不能改变该网页的队列顺序或优先级。**
  > [**关闭**] （按钮）
- toast 元素类型：GSC 用自定义 snackbar（非标准 `[role=alert]`），**用 body innerText 正则匹配最稳**。
- **关键运行细节**：点击「请求编入索引」后**先**弹出**实时测试进度弹窗**（不是立即成功）：
  > **正在测试实际网址可否编入索引**
  > **这可能需要花费 1-2 分钟的时间**
  > [**取消**] （按钮）
  - 该弹窗是 GSC 的 Live Test 阶段，**自动完成并自动提交**，无需点击任何额外按钮。
  - Task 12 flow：点「请求编入索引」后，轮询（每 6s，最多 ~180s）`document.body.innerText` 是否含
    「已请求编入索引」/「已将网址添加到优先抓取队列」→ 命中即成功。

### 2.8 `resetInput` — 回到可输入态  ✅ 已验证
- ✅ 实测：提交完成后**输入框仍在原位**，`aria-label` 不变，可直接清空再填下一个 URL。
  **不需要**专门的「重置/返回」按钮。
```js
const i = <inspectInput>;
i.focus(); i.select();
// 用 native setter 清空（同 2.2）
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(i, '');
i.dispatchEvent(new Event('input', { bubbles: true }));
// 然后填新 URL + 回车（同 2.2），会触发新的 inspect 导航
```
- 备选：若想强制回到搜索首页态，可 `location.href = GSC_URL`（不保留 `inspect?id=`），但通常没必要。

---

## 3. 登录态 / 权限态识别（Task 11 必做的前置检查）

打开 GSC URL 后、做任何操作前，先 eval：
```js
JSON.stringify({
  url: location.href,                 // 期望 https://search.google.com/u/0/search-console...
  title: document.title,              // 期望含「概述」/「Search Console」
  hasInspectInput: !!document.querySelector('input'),
  isLoginScreen: /accounts\.google\.com|signin/i.test(location.href),
  needsVerify: /您没有.*权限|verify that you own|无权访问/i.test(document.body.innerText)
})
```
- ✅ 实测 healthy 状态：`url` 以 `search.google.com/u/0/search-console` 开头、`title` 为「概述」、`hasInspectInput===true`。
- `isLoginScreen===true` → BLOCKED：未登录。
- `needsVerify===true` → BLOCKED：当前账号无该资源权限。
- `hasInspectInput===true && url 含 search-console && !isLoginScreen && !needsVerify` → OK，进入流程。

---

## 4. 本次实际执行的探测记录（备查）

| # | 操作 | 结果 |
|---|---|---|
| 1 | `GET /health` | `connected:null`（override 怪癖），但 `/new` 仍返回 targetId ✔ |
| 2 | `POST /new` GSC URL | targetId，tab 正常导航到 GSC |
| 3 | 轮询 `eval location.href` | 首次 poll 即为 `search.google.com/u/0/search-console`，title「概述」✔ VPN 已生效 |
| 4 | 探测 inputs | 命中 `aria-label="检查 bottleneck-checker.com 中的任何网址"` ✔ |
| 5 | native setter 填值 + Enter | URL 变 `/inspect?id=...`，title「网址检查」✔ |
| 6 | 轮询按钮 | 「请求编入索引」（DIV[role=button]，aria-disabled:false）✔ + 状态「网址尚未收录到 Google」✔ |
| 7 | 点击「请求编入索引」 | 弹出进度弹窗「正在测试实际网址可否编入索引（1-2 分钟）」+「取消」 ✔ |
| 8 | 轮询 ~60s 后 | toast「✓ 已请求编入索引」「已将网址添加到优先抓取队列中」+「关闭」 ✔ |
| 9 | 检查 reset | 输入框仍在原位，可直接清空复用 ✔ |
| 10 | `GET /close` | ✔ 关闭 |

**结论**：6 个 PROBES 全部对照真实 DOM 验证（其中 2.5 quota / 2.6 notOwned 因流程未触发而保留推断兜底）。
所有真实文案（中文）已记录，弹窗两步交互（进度弹窗 → 成功 toast）已观察清楚。
