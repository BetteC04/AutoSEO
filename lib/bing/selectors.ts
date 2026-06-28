/**
 * Bing Webmaster Tools「URL Inspection」页面探测表达式。
 *
 * ⚠️ 来源：docs/superpowers/notes/bing-probe.md §2（VERIFIED 2026-06-28）。
 * 已对照真实 Bing DOM 验证，**不要**改用通用/猜测正则。
 *
 * 设计原则：
 * - Bing 用稳定的 **`data-tag`** 作为锚点（实测 id 动态 `TextField+N`、class 含动态 hash 后缀
 *   如 `field-189`/`root-198`，但 data-tag 与语义 class `urlInspectionSectionTitle` 稳定）。
 * - 文案判定用 `document.body.innerText` 正则（与 GSC 一致，对中英文兼容）。
 * - 每个字段是一段**在页面执行的 JS 表达式**（元素选择器或 boolean 断言）。
 * - flow 负责轮询、点击、fill/reset 操作；本文件只提供**检测/判定**表达式。
 */
export const PROBES = {
  /**
   * 顶部「Enter URL to inspect」输入框（§2.1）。
   * 真实 `<input type="text" data-tag="urlInspectionInput">`，id 动态（**非** TextField107），
   * aria-label 含 siteUrl（如 `Enter URL to inspect in "https://bottleneck-checker.com/"`）。
   */
  inspectInput: `document.querySelector('[data-tag="urlInspectionInput"]')`,

  /**
   * 「Inspect」按钮（§2.3）。真实 `<button data-tag="inspectBtn" aria-label="Inspect">`。
   * ⚠️ Bing 靠**点击此按钮**触发检查（与 GSC 的回车不同）。
   */
  inspectBtn: `document.querySelector('[data-tag="inspectBtn"]')`,

  /**
   * 「Request indexing」按钮（§2.5）。真实 `<button data-tag="requestIndexingButton">`。
   * ⚠️ 已索引 / 未发现两态都显示此按钮（与 GSC 同坑）→ 不能用按钮存在性区分是否已索引。
   */
  requestIndexingButton: `document.querySelector('[data-tag="requestIndexingButton"]')`,

  /**
   * 确认弹窗里的「Submit」按钮（§2.6）。真实 `<button data-tag="submitBtn" aria-label="Submit">`。
   * 点击 Request indexing 后弹出确认弹窗（role=dialog「Are you sure…Quota left for today」）才出现。
   */
  submitBtn: `document.querySelector('[data-tag="submitBtn"]')`,

  /**
   * 确认弹窗已出现（§2.6）。点 Request indexing 后弹出的 `role=dialog`（含「Are you sure…」）。
   * 作为 ⑧ 的权威就绪信号——比 submitBtn 更早、更稳：实测 submitBtn 在主文档可查，但 chrome.debugger
   * 后台 tab 下 querySelector('[data-tag=submitBtn]') 命中可能滞后导致 15s 超时；弹窗本体先就绪，
   * 故以 dialog 为信号，⑨ 再多策略定位 Submit。
   */
  confirmDialog:
    `[...document.querySelectorAll('[role=dialog],[role=alertdialog]')].some(d => /are you sure|submit following/i.test(d.textContent || ''))`,

  /**
   * 检查结果区已加载（§2.4）。点击 Inspect 后先弹「Getting status from Bing Index」进度弹窗，
   * 数秒后自动关闭、结果填充到 `.urlInspectionSectionTitle`（语义 class，稳定）。
   * getting 期间该集合为空，结果出来后非空——用作 inspect 完成的权威就绪信号。
   */
  resultReady: `document.querySelectorAll('.urlInspectionSectionTitle').length > 0`,

  /**
   * URL 已被编入索引（§2.4）。已索引态 sections 首项「Indexed successfully」。
   * ⚠️ 只看此文案判定已索引；已索引页同样显示 Request indexing 按钮（不能叠加按钮缺失条件）。
   */
  isAlreadyIndexed: `/indexed successfully/i.test(document.body.innerText)`,

  /**
   * 提交成功提示（§2.7，核心）。真实元素 `<span role="alert">Indexing requested.</span>`。
   * 点 Submit 后确认弹窗自动关闭、随即出现；每次新 inspect 会刷新结果区、清除残留（无误判）。
   */
  successIndicator: `/indexing requested/i.test(document.body.innerText)`,

  /**
   * 配额耗尽兜底（§2.6，每日配额）。confirm 弹窗显示「Quota left for today : N URLs」；
   * 若 Submit 禁用或提交后 successIndicator 未出现且命中此类文案，判 isQuota。
   * 未直接触发，保留推断兜底。
   */
  isQuota:
    `/quota.*exceeded|out of quota|no.*quota.*left|try again later|稍后.*再试|已达.*上限|配额.*用尽/i.test(document.body.innerText)`,
} as const;

export type ProbeKey = keyof typeof PROBES;
