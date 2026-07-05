import { useEffect, useState } from 'react';
import Button from '../components/Button';
import Select from '../components/Select';
import ToolPanel from '../components/ToolPanel';
import { GoogleLogo, BingLogo, YandexLogo, QuickSearchLogo } from '../components/brand-logos';
import { buildGoogleSearchUrl, buildBingSearchUrl, buildYandexSearchUrl } from '@lib/quicksearch/url';
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
    <ToolPanel logo={<QuickSearchLogo size={18} />} title="搜索引擎查询">
      {/* 第 1 行:搜索定位 + Google 按钮(geo 仅作用于 Google) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-sm)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 4 }}>搜索定位</div>
          <Select value={geoCode} options={geoOptions} onChange={onGeoChange} />
        </div>
        <Button
          variant="secondary"
          onClick={() => chrome.tabs.create({ url: buildGoogleSearchUrl(keyword) })}
          disabled={disabled}
          style={{ flexShrink: 0 }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <GoogleLogo size={14} /> 用 Google 搜
          </span>
        </Button>
      </div>
      {/* 分割线:左右内缩 var(--space-xs),首尾不贯穿 */}
      <div data-testid="qs-divider" aria-hidden="true" style={{ borderTop: '1px solid var(--color-hairline)', margin: 'var(--space-sm) var(--space-xs)' }} />
      {/* 第 2 行:Bing + Yandex(Bing 在前) */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <Button
          variant="secondary"
          onClick={() => chrome.tabs.create({ url: buildBingSearchUrl(keyword) })}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <BingLogo size={14} /> 用 Bing 搜
          </span>
        </Button>
        <Button
          variant="secondary"
          onClick={() => chrome.tabs.create({ url: buildYandexSearchUrl(keyword) })}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <YandexLogo size={14} /> 用 Yandex 搜
          </span>
        </Button>
      </div>
    </ToolPanel>
  );
}
