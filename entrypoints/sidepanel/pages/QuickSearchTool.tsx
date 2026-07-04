import { useEffect, useState } from 'react';
import Button from '../components/Button';
import Select from '../components/Select';
import ToolPanel from '../components/ToolPanel';
import { GoogleLogo, BingLogo } from '../components/brand-logos';
import { buildGoogleSearchUrl, buildBingSearchUrl } from '@lib/quicksearch/url';
import { GEO_REGIONS, GEO_OFF, getGeoPref, setGeoPref, type GeoCode } from '@lib/quicksearch/geo';

interface Props { keyword: string; }

export default function QuickSearchTool({ keyword }: Props) {
  const disabled = !keyword.trim();
  const [geoCode, setGeoCode] = useState<GeoCode>('US');

  useEffect(() => {
    void (async () => setGeoCode((await getGeoPref()).code))();
  }, []);

  function onGeoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value as GeoCode;
    setGeoCode(v);
    void setGeoPref(v); // background 监听 storage 变化,实时增删规则
  }

  const geoOptions = [
    { value: GEO_OFF, label: '🚪 关闭(用真实位置)' },
    ...GEO_REGIONS.map((r) => ({ value: r.code, label: `${r.flag} ${r.label}` })),
  ];

  return (
    <ToolPanel logo={<GoogleLogo size={18} />} title="快捷搜索">
      <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
        {/* 左列:geo + Google 按钮,宽度绑定 —— 明确 geo 只属于 Google */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 4 }}>位置(仅 Google)</div>
            <Select value={geoCode} options={geoOptions} onChange={onGeoChange} />
          </div>
          <Button
            variant="secondary"
            onClick={() => chrome.tabs.create({ url: buildGoogleSearchUrl(keyword) })}
            disabled={disabled}
            style={{ width: '100%' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <GoogleLogo size={14} /> 用 Google 搜
            </span>
          </Button>
        </div>
        {/* 右列:Bing 按钮,独立,不受 geo 影响;与 Google 按钮底部对齐 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Button
            variant="secondary"
            onClick={() => chrome.tabs.create({ url: buildBingSearchUrl(keyword) })}
            disabled={disabled}
            style={{ width: '100%' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <BingLogo size={14} /> 用 Bing 搜
            </span>
          </Button>
        </div>
      </div>
    </ToolPanel>
  );
}
