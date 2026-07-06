/**
 * 报告分类常量与判定。
 *
 * 现有 SubmitResult.status 只有 'ok' | 'skipped'，无 'failed'。
 * skipped 里既有「预期跳过」（已索引/配额/…），也有「非预期失败」（检查未出现/步骤异常/网络错误/密钥无效…）。
 * 采用**反向枚举**：reason 命中 SKIP_REASONS → 跳过；其余 skipped 兜底归失败，
 * 这样能覆盖各平台动态 reason，无需穷举失败集合。
 *
 * reason 文案须与 lib/gsc/submit.ts（GSC Indexing API）/ lib/indexnow/submit.ts（IndexNow API）产出一致。
 * 注：IndexNow 失败 reason（密钥无效/网络错误/频率限制/…）刻意不列入 SKIP_REASONS，
 * 归 failed 以在报告中醒目提示用户干预（重试逻辑不受影响：isSubmittedOk 只看 ok）。
 */
export const SKIP_REASONS = ['已索引', '不属于此域名', '配额', '未执行（批次终止）'] as const;

export type Outcome = 'ok' | 'failed' | 'skipped';

export function classifyResult(r: { status: 'ok' | 'skipped'; reason?: string }): Outcome {
  if (r.status === 'ok') return 'ok';
  if (r.reason && (SKIP_REASONS as readonly string[]).includes(r.reason)) return 'skipped';
  return 'failed';
}
