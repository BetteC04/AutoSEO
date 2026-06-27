# GSC 真实页面 CDP 探测笔记（Task 10）

> 状态：**BLOCKED — 未完成实质探测**。本文件记录探测过程中的关键运维发现与未决问题，
> 供 Task 11 在环境恢复后重跑。`PROBES` 表达式栏位为「待验证」状态——基于 GSC 公开 DOM 约定
> 与 Task 9 引擎约定的预期值，**未经真实页面校验**，Task 11 必须在能访问 GSC 的浏览器里复核后再固化进 `selectors.ts`。

## 0. 探测结论：BLOCKED（网络层无法到达 Google）

### 现象
通过 web-access CDP proxy（`http://localhost:3456`，连到本机 Microsoft Edge 9222 端口）打开
GSC 检查页 `https://search.google.com/u/0/search-console?resource_id=sc-domain%3Abottleneck-checker.com`：

- `/new` 与 `/navigate` 均能让 Edge 创建 tab，`/targets` 元数据里目标 URL 正确，
  但页面**实际文档停在 `about:blank`**（`Target.createTarget {background:true}` 创建的后台 tab，
  Edge 不会真正发起导航，直到 tab 被激活）。
- 用页内 `location.href = <GSC URL>` 强制导航后，页面落到 `chrome-error://chromewebdata/`，
  错误文案：**`ERR_TIMED_OUT` / "search.google.com 响应时间太长"**。
- 对照实验：同一 tab 内 `https://example.com/` 可正常加载（标题 `Example Domain`），
  说明 **浏览器联网正常，唯独 `*.google.com`（含 `search.google.com`、`www.google.com`）超时不可达**。

### 判定
被驱动的 Edge profile 处于无法访问 Google 服务的网络环境（典型为中国大陆直连未走代理/VPN）。
**不是登录问题**——根本没到登录页，是 TCP 层就超时。因此无法判断该 Edge 是否已登录拥有
`bottleneck-checker.com` 资源的 Google 账号。

### 用户需要做什么才能解除阻塞
1. 在**被 CDP 驱动的这个 Edge profile**（即监听 9222 端口、proxy `connected:true` 报告的那个 Edge）
   里配置并启用可访问 Google 的代理 / VPN（系统代理或 Edge 扩展均可，需对 `*.google.com` 生效）。
2. 在该 Edge 里手动打开 `https://search.google.com/u/0/search-console`，确认能加载到
   Search Console 界面（不是 `ERR_TIMED_OUT`），并登录拥有 `bottleneck-checker.com` 的 Google 账号、
   选中该资源。
3. 保持 Edge 开着远程调试（9222）重启 web-access proxy（`curl http://localhost:3456/health` → `connected:true`）。
4. 重跑 Task 10：本文档「待验证」的 PROBES 即可在真实 DOM 上校准。

---

## 1. CDP proxy 运维发现（已验证，Task 11 会用到）

> 这些是 proxy 行为事实，与 GSC 无关，任何目标站点都成立。

| 现象 | 说明 | 对策 |
|---|---|---|
| `/new` 创建的后台 tab 实际停在 `about:blank` | Edge 对 `Target.createTarget {background:true}` 不立即导航，`/info` 的 `waitForLoad` 又只轮询 `document.readyState`（about:blank 永远 `complete`），于是立刻返回 | **创建后必须显式 `/navigate` 或页内 `location.href=` 触发真实导航**，不能假设 `/new` 返回时页面已加载 |
| `/navigate` 默认 15s `waitForLoad`，重 SPA（GSC/Ahrefs）常超时 | proxy `waitForLoad` 轮询 `readyState==='complete'`，GSC 的 load 事件晚或不到 | **忽略 `/navigate` 的 timeout 报错**，改用后续轮询 `/eval` 检查 `location.href` 与目标 DOM 是否就位 |
| 跨页导航后 `Runtime.evaluate` 可能短暂超时 | 导航中途旧 execution context 已销毁、新上下文未就绪 | 导航后**先 sleep 3–5s** 再首次 eval；遇 `CDP 命令超时` 重试一次 |
| `/targets` 元数据 URL ≠ 实际文档 URL | 元数据是「目标意图 URL」，实际加载的看 `/info` 或 eval `location.href` | **以 `eval location.href` 为准**判断当前页，不要信 `/targets` 的 url 字段 |

**推荐 Task 11 的「打开 GSC」子流程**（适配上述行为）：
```
1. POST /new  body=GSC_URL            -> targetId T   （tab 创建，停在 about:blank）
2. POST /navigate?target=T body=GSC_URL
   （忽略其可能返回的 timeout 错误）
3. 轮询（每 2s，最多 ~30s）：
     POST /eval?target=T  -> JSON.stringify({u:location.href, ready:document.readyState, hasInput:!!document.querySelector('input')})
   直到 u 以 https://search.google.com 开头 且 hasInput===true（或检测到登录态/无权限态，见下）
4. 进入 URL 检查流程
```

---

## 2. 待验证的 PROBES（Task 11 必须在真实页面复核）

> ⚠️ 以下表达式基于 GSC 的稳定 DOM 约定（Material 组件、固定 aria-label / placeholder 文案）写出，
> **未经本任务真实页面验证**（被网络阻塞）。Google 的 class 名是动态 hash，**切勿依赖 class**，
> 全部用 placeholder / aria-label / role / 可见文本匹配。Task 11 跑通后请把每条的「观察值」回填进本表。

GSC URL 检查界面的语言会跟随 Google 账号语言设置（中文账号→中文文案，英文账号→英文文案）。
** selectors.ts 应同时匹配中英文两种文案**，下表 `正则` 列即为此设计。

### 2.1 `inspectInput` — 顶部「检查网址」输入框
```js
// 预期：GSC 顶部有一个文本输入框，placeholder 中文「检查网址」/ 英文「Inspect any URL」
[...document.querySelectorAll('input')].find(i =>
  /检查网址|inspect|检查/i.test(
    (i.placeholder || '') + ' ' + (i.getAttribute('aria-label') || '')
  )
)
```
- 等待条件：`document.querySelector('input')` 存在 且 `location.href` 含 `search-console`。
- 待观察：真实 placeholder 文案、`type` 属性（`text`/`url`/`search`）、外层是否有 `<form>`。

### 2.2 填值并提交
```js
// 聚焦 → 赋值 → 派发 input 事件 → 回车
const i = [...document.querySelectorAll('input')].find(x =>
  /检查网址|inspect|检查/i.test((x.placeholder||'')+' '+(x.getAttribute('aria-label')||''))
);
i.focus();
i.value = TARGET_URL;                                   // 如 https://bottleneck-checker.com/es/
i.dispatchEvent(new Event('input', { bubbles: true }));
i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
i.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
i.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
```
- 备选：若回车不触发，找输入框右侧的提交按钮（放大镜 / 箭头图标按钮，`aria-label` 可能是「检查」/「Inspect」）点击。
- 待观察：GSC 实际接受 `Enter` 还是必须点按钮；React 受控组件是否需要 `nativeInputValueSetter` 才能认值。
  （若直接赋 `value` 无效，用：
  ```js
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(i, TARGET_URL); i.dispatchEvent(new Event('input', { bubbles: true }));
  ```

### 2.3 `requestIndexingButton` — 「请求编入索引」按钮
```js
// 预期：URL 检查结果加载后，结果区出现按钮，文案中文「请求编入索引」/ 英文「Request indexing」
[...document.querySelectorAll('button,[role="button"]')].find(b =>
  /请求编入索引|request indexing/i.test((b.textContent || '').trim())
)
```
- 状态读取：`button.disabled` 或 `button.getAttribute('aria-disabled')==='true'`。
- 待观察：按钮是否一开始 disabled 几秒（GSC 内部查重）然后 enabled；文案是否有空格/换行需 `trim()`。

### 2.4 `isAlreadyIndexed` — URL 已被编入索引（无需再请求）
```js
// 预期：结果区出现「URL 已在 Google 上」/「URL is on Google」字样，且请求编入索引按钮不可见或灰
/已在 Google 上|URL is on Google|已编入索引/i.test(document.body.innerText)
```
- 待观察：GSC 真实文案（可能是「网址已编入索引」等变体）；建议同时检测 `requestIndexingButton` 不存在。

### 2.5 `isQuota` — 配额耗尽提示
```js
// 预期：点击请求编入索引后，弹窗或 toast 出现「已达上限」/「配额」/「quota」字样
/已达.*上限|配额|quota|try again later|稍后.*再试/i.test(document.body.innerText)
```
- 待观察：真实文案；是 toast（几秒消失）还是对话框（需关闭）。

### 2.6 `isNotOwned` — 当前账号无该资源权限（理论上不会发生，因 URL 在资源内）
```js
/您没有.*权限|don't have (access|permission)|无权访问|verify/i.test(document.body.innerText)
```
- 通常本场景不会触发（URL 属于已选资源）；保留兜底。

### 2.7 `successIndicator` — 提交成功提示
```js
// 预期：点击请求编入索引 → 弹窗里有「我同意」/ 单选确认 → 提交后 toast「已请求编入索引」/「Requested」
/已请求编入索引|已提交|request (has been )?(received|submitted)|submitted/i.test(document.body.innerText)
```
- 待观察 GSC 的两步交互：
  1. 点击「请求编入索引」→ 弹出对话框（可能含「我同意…」checkbox + 「提交」按钮，或一个单选「是否仅此 URL / 含此页面及其链接」）。
  2. 点对话框里的确认按钮 → 触发提交 → 出现成功 toast。
- 需要记录：弹窗确认按钮的真实文案、checkbox 选择器、成功 toast 文案与持续时长。

### 2.8 `resetInput` — 回到可输入态
```js
// 方式 A：URL 检查框旁有「清除 / 重置 / ✕」按钮
[...document.querySelectorAll('button,[role="button"]')].find(b =>
  /清除|重置|clear|reset|✕/i.test((b.textContent||'').trim() + ' ' + (b.getAttribute('aria-label')||''))
)
// 方式 B：直接全选删除
const i = <inspectInput>;
i.focus(); i.select(); 
(document.execCommand ? document.execCommand('delete') : (i.value='', i.dispatchEvent(new Event('input',{bubbles:true}))));
```
- 待观察：GSC 是否提供专门的「重置/返回」按钮（通常在检查结果标题旁，文案可能是「✕」或「返回」），
  以及清空输入后是否需要再回车才会退出检查结果视图。

---

## 3. 登录态 / 权限态识别（Task 11 必做的前置检查）

打开 GSC URL 后、做任何操作前，先 eval：
```js
JSON.stringify({
  url: location.href,                 // 期望以 https://search.google.com/u/0/search-console 开头
  title: document.title,              // 期望含 "Search Console" / "搜索"
  hasInspectInput: !!document.querySelector('input'),
  isLoginScreen: /accounts\.google\.com|signin|accounts\.google/i.test(location.href),
  needsVerify: /verify|验证|您没有|权限/i.test(document.body.innerText)
})
```
- `isLoginScreen===true` → BLOCKED：未登录，需用户在 Edge 里登录。
- `needsVerify===true` → BLOCKED：当前账号无 `bottleneck-checker.com` 权限。
- `hasInspectInput===true && url 含 search-console` → OK，进入流程。
- **本任务这三项都没能跑**——因为卡在更底层的 `ERR_TIMED_OUT`，连 `location.href` 都到不了 `search.google.com`。

---

## 4. 本次实际执行的探测记录（备查）

| # | 操作 | 结果 |
|---|---|---|
| 1 | `GET /health` | `connected:true`, Edge, 9222 ✔ |
| 2 | `POST /new` GSC URL → targetId | 返回 targetId，但文档停 about:blank |
| 3 | `/info`、`/eval` 轮询 | 持续 about:blank（后台 tab 未导航） |
| 4 | 页内 `location.href=GSC` | 落到 `chrome-error://chromewebdata/`，`ERR_TIMED_OUT`（search.google.com） |
| 5 | 对照 `location.href=https://example.com/` | ✔ 正常加载（联网本身没问题） |
| 6 | `location.href=https://www.google.com/` | 同样 ERR_TIMED_OUT（整个 *.google.com 不可达） |
| 7 | 关闭 tab，`/health` 恢复 sessions:0 | ✔ proxy 健康 |

**结论**：被驱动的 Edge profile 无法访问 Google 服务（疑似大陆网络未走代理）。
非 proxy bug、非登录问题、非 selector 问题——是网络可达性阻塞。
