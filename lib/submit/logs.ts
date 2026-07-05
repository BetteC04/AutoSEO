export type LogPlatform = 'sys' | 'gsc' | 'bing';

export interface SrcLogEntry {
  level: 'info' | 'warn' | 'error';
  phase: string;
  message: string;
  ts: number;
}

export interface UnifiedLogEntry extends SrcLogEntry {
  platform: LogPlatform;
}

/**
 * 三路日志（系统 / GSC / Bing）按 ts 升序稳定合并为统一时间流。
 * 同 ts 时保持 sys → gsc → bing 的输入相对顺序（稳定排序）。
 * 纯函数，不读外部状态、不引入随机/时间。
 */
export function mergeLogs(sys: SrcLogEntry[], gsc: SrcLogEntry[], bing: SrcLogEntry[]): UnifiedLogEntry[] {
  const withSeq: Array<{ entry: UnifiedLogEntry; seq: number }> = [];
  let seq = 0;
  const push = (arr: SrcLogEntry[], platform: LogPlatform) => {
    for (const l of arr) withSeq.push({ entry: { ...l, platform }, seq: seq++ });
  };
  push(sys, 'sys');
  push(gsc, 'gsc');
  push(bing, 'bing');
  withSeq.sort((a, b) => a.entry.ts - b.entry.ts || a.seq - b.seq);
  return withSeq.map((x) => x.entry);
}
