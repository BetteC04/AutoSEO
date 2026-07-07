import { useCallback, useEffect, useState } from 'react';
import { getSettings, updateSettings, generateIndexNowKey } from '@lib/storage/settings';
import { verifyKeyFile } from '@lib/indexnow/submit';

const SETTINGS_KEY = 'settings';

export type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

/**
 * IndexNow 全局密钥状态：读 settings.indexnowKey，跨视图同步（storage.onChanged）。
 * - generate：生成随机 key 并落库（onChanged 回写 state）。
 * - refresh：confirm 通过后 generate（覆盖旧 key → 各站需重新上传 <key>.txt）。
 * - download：用 Blob 触发浏览器下载 <key>.txt（内容=key），供用户上传到站点根目录。
 * - testConnection(host)：GET <host>/<key>.txt 验证密钥文件部署，结果写入 testStatus/testMessage。
 */
export function useIndexNowKey() {
  const [key, setKey] = useState<string | undefined>(undefined);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState<string | undefined>(undefined);

  // 初次读
  useEffect(() => {
    let active = true;
    getSettings().then((s) => { if (active) setKey(s.indexnowKey); });
    return () => { active = false; };
  }, []);

  // 跨视图同步
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !changes[SETTINGS_KEY]) return;
      const next = (changes[SETTINGS_KEY].newValue as { indexnowKey?: string } | undefined)?.indexnowKey;
      setKey(next);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const generate = useCallback(() => {
    void updateSettings({ indexnowKey: generateIndexNowKey() });  // onChanged 回写
  }, []);

  const refresh = useCallback(() => {
    if (!window.confirm('刷新会覆盖当前密钥，旧密钥文件立即作废，所有站点需重新上传。确认？')) return;
    generate();
  }, [generate]);

  const download = useCallback(() => {
    if (!key) return;
    const blob = new Blob([key], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [key]);

  const testConnection = useCallback(async (host: string) => {
    if (!key) return;
    setTestStatus('testing');
    setTestMessage(undefined);
    const r = await verifyKeyFile(key, host);
    if (r.ok) {
      setTestStatus('ok');
      setTestMessage(`密钥文件已正确部署到 ${host}，可正常提交`);
    } else {
      setTestStatus('fail');
      setTestMessage(r.reason);
    }
  }, [key]);

  return { key, generate, refresh, download, testConnection, testStatus, testMessage };
}
