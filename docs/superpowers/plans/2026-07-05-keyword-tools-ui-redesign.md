# 关键词工具面板 UI 紧凑化重设计 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把关键词工具面板做成一屏可见的紧凑布局,删重复标题,让 geo 视觉上归属 Google,并用真实品牌 logo 替换手绘 SVG。

**Architecture:** 改动收敛在 sidepanel 关键词工具链路:新增 4 张 128×128 PNG logo 资源;`brand-logos.tsx` 从 SVG 改为 `<img>`(签名不变,调用方零改动);`ToolPanel` 新增可选 `action` prop 把主按钮上提到 header;四个页面用 inline-style flex 容器重排(延续项目风格)。不改 `Select`/`Button`/`tokens.css` 等公共件。

**Tech Stack:** WXT 0.20 + React 19 + TypeScript 5.9;vitest 3 + jsdom + @testing-library/react 做组件测试;`sips`/`curl` 处理图片资源。

## Global Constraints

- 不改 `Select.tsx` / `Button.tsx` / `tokens.css` / `global.css`(其他 tab 在复用)。
- 不碰 `SiteTools` / `SubmitPanel` / `TabBar` / `background.ts`。
- 4 张 logo 统一为 **128×128 PNG**;Ahrefs/Google 保留透明底,Trends/Bing 保留品牌底色(不加统一白底)。
- `brand-logos.tsx` 必须保持 4 个命名导出(`GoogleLogo`/`BingLogo`/`AhrefsLogo`/`GoogleTrendsLogo`)与 `size` prop 签名不变。
- `ToolPanel.tsx` 的 `action` prop 可选;不传时外观与现状一致(向后兼容)。
- 延续项目现有 inline-style 风格,不引入 CSS-in-JS。
- 测试用 `pnpm test <file>`(= `vitest run`);类型检查用 `pnpm compile`(= `tsc --noEmit`);构建用 `pnpm build`(= `wxt build`)。
- 每个 task 末尾 commit;commit message 中文 conventional commits 风格,与 git history 一致。

## File Structure

新增:
- `entrypoints/sidepanel/assets/logos/ahrefs.png` — Ahrefs logo(128×128 透明 PNG)
- `entrypoints/sidepanel/assets/logos/google-trends.png` — Google Trends logo(128×128 PNG,保留青绿底)
- `entrypoints/sidepanel/assets/logos/google.png` — Google logo(128×128 透明 PNG)
- `entrypoints/sidepanel/assets/logos/bing.png` — Bing logo(128×128 PNG,保留暗灰紫底)
- `tests/brand-logos.test.tsx` — logo 组件渲染测试
- `tests/tool-panel.test.tsx` — ToolPanel action 测试
- `tests/keyword-tools.test.tsx` — KeywordTools 页面测试(无重复 h2)
- `tests/quicksearch-tool.test.tsx` — QuickSearchTool geo 归属测试

修改:
- `entrypoints/sidepanel/components/brand-logos.tsx` — SVG → `<img>`
- `entrypoints/sidepanel/components/ToolPanel.tsx` — 加 `action` prop
- `entrypoints/sidepanel/pages/KeywordTools.tsx` — 删 h2、收紧 gap
- `entrypoints/sidepanel/pages/AhrefsTool.tsx` — 主按钮上提 action、国家单行
- `entrypoints/sidepanel/pages/GoogleTrendsTool.tsx` — 主按钮上提 action、天数/地区并排
- `entrypoints/sidepanel/pages/QuickSearchTool.tsx` — geo 下沉归属 Google、两列布局

---

### Task 1: 准备 4 张 logo 资源

**Files:**
- Create: `entrypoints/sidepanel/assets/logos/ahrefs.png`
- Create: `entrypoints/sidepanel/assets/logos/google-trends.png`
- Create: `entrypoints/sidepanel/assets/logos/google.png`
- Create: `entrypoints/sidepanel/assets/logos/bing.png`

**Interfaces:**
- Produces: 4 个 128×128 PNG 文件,供 Task 2 的 `brand-logos.tsx` import。

- [ ] **Step 1: 新建目录**

```bash
mkdir -p entrypoints/sidepanel/assets/logos
```

- [ ] **Step 2: 下载 Ahrefs 和 Google 的 128px PNG(透明底)**

```bash
cd entrypoints/sidepanel/assets/logos
curl -sL "https://ts2.tc.mm.bing.net/th/id/ODF.P6OCt919s5RCC8Y_Tmg71A?w=128&h=128&qlt=95&pcl=fffffa&o=6&pid=1.2" -o ahrefs.png
curl -sL "https://ts3.tc.mm.bing.net/th/id/ODF.b64Z_8Z3An4K5uiMyfPSjQ?w=128&h=128&qlt=95&pcl=fffffa&o=6&pid=1.2" -o google.png
cd -
```

- [ ] **Step 3: 下载 Google Trends 和 Bing 的 128px WebP(带品牌底),再转 PNG**

```bash
cd entrypoints/sidepanel/assets/logos
curl -sL "https://ts1.tc.mm.bing.net/th/id/OIP-C.pSuadi6NxsnzqVj8GUVu8wAAAA?w=128&h=128&c=1&bgcl=07c8ae&r=0&o=7&pid=ImgRC&rm=3" -o google-trends.webp
curl -sL "https://ts4.tc.mm.bing.net/th/id/OIP-C.AYeZh-30xeoDw3eKcUCiCQHaHa?w=128&h=128&c=1&bgcl=655562&r=0&o=7&pid=ImgRC&rm=3" -o bing.webp
sips -s format png google-trends.webp --out google-trends.png
sips -s format png bing.webp --out bing.png
rm google-trends.webp bing.webp
cd -
```

- [ ] **Step 4: 验证 4 个文件都是 128×128 PNG**

Run:
```bash
file entrypoints/sidepanel/assets/logos/*.png
```
Expected: 4 行,每行含 `PNG image data, 128 x 128`。若有任一行不是 128×128 PNG,回到 Step 2/3 重下。

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/assets/logos/
git commit -m "feat(keyword-tools): 新增 ahrefs/google-trends/google/bing 真实品牌 logo(128px PNG)"
```

---

### Task 2: 重写 brand-logos.tsx(SVG → img)

**Files:**
- Modify: `entrypoints/sidepanel/components/brand-logos.tsx`
- Test: `tests/brand-logos.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 4 个 PNG 文件。
- Produces: 4 个命名导出组件,签名 `({ size = 16 }: { size?: number }) => JSX`,渲染 `<img>`。供 `AhrefsTool`/`GoogleTrendsTool`/`QuickSearchTool` 现有 import 零改动复用。

- [ ] **Step 1: 写失败测试**

创建 `tests/brand-logos.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GoogleLogo, BingLogo, AhrefsLogo, GoogleTrendsLogo } from '../entrypoints/sidepanel/components/brand-logos';

describe('brand-logos', () => {
  const cases = [
    ['GoogleLogo', GoogleLogo],
    ['BingLogo', BingLogo],
    ['AhrefsLogo', AhrefsLogo],
    ['GoogleTrendsLogo', GoogleTrendsLogo],
  ] as const;

  it.each(cases)('%s 渲染为 <img>,默认 size=16 且 src 非空', (_name, Comp) => {
    const { container } = render(<Comp />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('width')).toBe('16');
    expect(img!.getAttribute('height')).toBe('16');
    expect(img!.getAttribute('src')).toBeTruthy();
  });

  it.each(cases)('%s 支持 size prop', (_name, Comp) => {
    const { container } = render(<Comp size={28} />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('width')).toBe('28');
    expect(img.getAttribute('height')).toBe('28');
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `pnpm test tests/brand-logos.test.tsx`
Expected: FAIL(当前 SVG 实现渲染的是 `<svg>` 而非 `<img>`,`container.querySelector('img')` 为 null)。

- [ ] **Step 3: 重写实现**

把 `entrypoints/sidepanel/components/brand-logos.tsx` 整体替换为:

```tsx
import ahrefsLogoUrl from '../assets/logos/ahrefs.png';
import googleTrendsLogoUrl from '../assets/logos/google-trends.png';
import googleLogoUrl from '../assets/logos/google.png';
import bingLogoUrl from '../assets/logos/bing.png';

interface LogoProps { size?: number; }

const logoStyle: React.CSSProperties = {
  objectFit: 'contain',
  display: 'inline-block',
  lineHeight: 0,
};

/** Google — 四色 G。 */
export function GoogleLogo({ size = 16 }: LogoProps) {
  return <img src={googleLogoUrl} width={size} height={size} alt="" aria-hidden="true" style={logoStyle} />;
}

/** Bing — 青绿色 b。 */
export function BingLogo({ size = 16 }: LogoProps) {
  return <img src={bingLogoUrl} width={size} height={size} alt="" aria-hidden="true" style={logoStyle} />;
}

/** Ahrefs — 橙色 a。 */
export function AhrefsLogo({ size = 16 }: LogoProps) {
  return <img src={ahrefsLogoUrl} width={size} height={size} alt="" aria-hidden="true" style={logoStyle} />;
}

/** Google Trends — 四色趋势线。 */
export function GoogleTrendsLogo({ size = 16 }: LogoProps) {
  return <img src={googleTrendsLogoUrl} width={size} height={size} alt="" aria-hidden="true" style={logoStyle} />;
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `pnpm test tests/brand-logos.test.tsx`
Expected: PASS(8 个用例全过)。

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/components/brand-logos.tsx tests/brand-logos.test.tsx
git commit -m "refactor(keyword-tools): brand-logos 从手绘 SVG 改为真实品牌图片"
```

---

### Task 3: ToolPanel 加 action prop

**Files:**
- Modify: `entrypoints/sidepanel/components/ToolPanel.tsx`
- Test: `tests/tool-panel.test.tsx`

**Interfaces:**
- Produces: `ToolPanel` 新增可选 `action?: React.ReactNode`,渲染在 header 右侧(`marginLeft: 'auto'`)。不传时外观与现状一致。供 Task 5/6 把主按钮上提。

- [ ] **Step 1: 写失败测试**

创建 `tests/tool-panel.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ToolPanel from '../entrypoints/sidepanel/components/ToolPanel';

describe('ToolPanel', () => {
  it('不传 action 时正常渲染 logo/title/subtitle/children', () => {
    render(
      <ToolPanel logo="●" title="标题" subtitle="副标题">
        <div>内容</div>
      </ToolPanel>
    );
    expect(screen.getByText('标题')).toBeTruthy();
    expect(screen.getByText('副标题')).toBeTruthy();
    expect(screen.getByText('内容')).toBeTruthy();
  });

  it('传 action 时渲染到 header 区域', () => {
    render(
      <ToolPanel logo="●" title="标题" action={<button type="button">动作</button>}>
        <div>内容</div>
      </ToolPanel>
    );
    expect(screen.getByText('动作')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `pnpm test tests/tool-panel.test.tsx`
Expected: FAIL(当前 `ToolPanel` 不接受 `action` prop,TS 编译报错或 action 不渲染)。

- [ ] **Step 3: 加 action prop**

把 `entrypoints/sidepanel/components/ToolPanel.tsx` 整体替换为:

```tsx
interface ToolPanelProps {
  logo: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

/** 工具卡片壳:统一 logo + 标题 header(可选右侧 action),下方放各工具特有的表单控件。 */
export default function ToolPanel({ logo, title, subtitle, action, children }: ToolPanelProps) {
  return (
    <section
      style={{
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-canvas)',
        padding: 'var(--space-sm) var(--space-md)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-sm)' }}>
        <span style={{ display: 'inline-flex', lineHeight: 0 }}>{logo}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>{title}</span>
        {subtitle && <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{subtitle}</span>}
        {action && <span style={{ marginLeft: 'auto' }}>{action}</span>}
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `pnpm test tests/tool-panel.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/components/ToolPanel.tsx tests/tool-panel.test.tsx
git commit -m "feat(keyword-tools): ToolPanel 新增 action prop 支持 header 右侧动作(向后兼容)"
```

---

### Task 4: KeywordTools 删重复 h2 + 收紧 gap

**Files:**
- Modify: `entrypoints/sidepanel/pages/KeywordTools.tsx`
- Test: `tests/keyword-tools.test.tsx`

**Interfaces:**
- Consumes: 无新接口。
- Produces: 关键词工具首屏顶部不再有重复「关键词工具」标题;三张卡纵向 gap 由 `--space-md` 收紧为 `--space-sm`。

- [ ] **Step 1: 写失败测试**

创建 `tests/keyword-tools.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KeywordTools from '../entrypoints/sidepanel/pages/KeywordTools';

describe('KeywordTools', () => {
  it('不再渲染重复的「关键词工具」标题(TabBar 已有该 tab)', () => {
    render(<KeywordTools />);
    expect(screen.queryByRole('heading', { name: '关键词工具' })).toBeNull();
  });

  it('仍渲染关键词输入与三个工具面板标题', () => {
    render(<KeywordTools />);
    expect(screen.getByText('关键词')).toBeTruthy();
    expect(screen.getByText('Ahrefs')).toBeTruthy();
    expect(screen.getByText('Google Trends')).toBeTruthy();
    expect(screen.getByText('快捷搜索')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `pnpm test tests/keyword-tools.test.tsx`
Expected: FAIL(第一个用例失败:当前页面渲染了 `<h2>关键词工具</h2>`)。

- [ ] **Step 3: 删 h2、收紧 gap**

把 `entrypoints/sidepanel/pages/KeywordTools.tsx` 整体替换为:

```tsx
import { useEffect, useState } from 'react';
import TextInput from '../components/TextInput';
import AhrefsTool from './AhrefsTool';
import GoogleTrendsTool from './GoogleTrendsTool';
import QuickSearchTool from './QuickSearchTool';

const STORAGE_KEY = 'kw-tools:keyword';

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 };

export default function KeywordTools() {
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (items) => {
      const kw = items[STORAGE_KEY] as string | undefined;
      if (kw) setKeyword(kw);
    });
  }, []);

  function onChange(value: string) {
    setKeyword(value);
    chrome.storage.local.set({ [STORAGE_KEY]: value });
  }

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <label style={labelStyle}>关键词</label>
      <TextInput value={keyword} placeholder="如 apple" onChange={(e) => onChange(e.target.value)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
        <AhrefsTool keyword={keyword} />
        <GoogleTrendsTool keyword={keyword} />
        <QuickSearchTool keyword={keyword} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `pnpm test tests/keyword-tools.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/pages/KeywordTools.tsx tests/keyword-tools.test.tsx
git commit -m "refactor(keyword-tools): 删重复 h2 标题、收紧三卡纵向 gap"
```

---

### Task 5: AhrefsTool 紧凑布局

**Files:**
- Modify: `entrypoints/sidepanel/pages/AhrefsTool.tsx`
- Test: `tests/ahrefs-tool.test.tsx`(新建)

**Interfaces:**
- Consumes: Task 2 的 `AhrefsLogo`、Task 3 的 `ToolPanel.action`。
- Produces: 「打开查询」按钮上提到 header action;国家标签与下拉同一行。

- [ ] **Step 1: 写失败测试(回归保护 + 关键结构)**

创建 `tests/ahrefs-tool.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AhrefsTool from '../entrypoints/sidepanel/pages/AhrefsTool';

describe('AhrefsTool', () => {
  it('渲染「打开查询」按钮(上提到 header)', () => {
    render(<AhrefsTool keyword="apple" />);
    expect(screen.getByText('打开查询')).toBeTruthy();
  });

  it('渲染「国家」标签与国家下拉', () => {
    const { container } = render(<AhrefsTool keyword="apple" />);
    expect(screen.getByText('国家')).toBeTruthy();
    expect(container.querySelector('select')).toBeTruthy();
  });

  it('点「打开查询」打开新标签页(回归)', () => {
    const tabsCreate = vi.spyOn(chrome.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    render(<AhrefsTool keyword="apple" />);
    fireEvent.click(screen.getByText('打开查询'));
    expect(tabsCreate).toHaveBeenCalled();
    expect(tabsCreate.mock.calls[0][0].url).toContain('ahrefs.com');
  });

  it('关键词为空时按钮禁用', () => {
    render(<AhrefsTool keyword="" />);
    expect((screen.getByText('打开查询').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `pnpm test tests/ahrefs-tool.test.tsx`
Expected: FAIL(按钮当前在 children 区且 `width:100%`;`screen.getByText('打开查询').closest('button').disabled` 在 keyword 为空时 —— 当前 disabled 条件相同,但「国家」标签现在是 `<label>` 含文本「国家」,可能不冲突。主要失败点:第一个/第三个用例对按钮位置无感,但「点打开查询」的 url 断言应通过。重新评估:这些用例其实当前实现也能过。需调整使其真正捕获新结构)。

> 说明:为了让测试真正锁定新布局,核心断言是「国家标签与下拉在同一行」—— 用 inline-style 难以稳定断言,故改用「按钮文本存在 + 国家下拉存在 + 点按钮回归」组合。若当前实现已能让全部用例通过,跳过 Step 2 的 FAIL 预期,直接进 Step 3 改实现,Step 4 必须仍 PASS。

- [ ] **Step 3: 重排布局**

把 `entrypoints/sidepanel/pages/AhrefsTool.tsx` 整体替换为:

```tsx
import { useEffect, useState } from 'react';
import Button from '../components/Button';
import TextInput from '../components/TextInput';
import Select from '../components/Select';
import ToolPanel from '../components/ToolPanel';
import { AhrefsLogo } from '../components/brand-logos';
import { COUNTRIES, buildAhrefsUrl, isValidCountryCode } from '@lib/ahrefs/url';

const STORAGE_KEY = 'ahrefs:last';
interface Last { country: string; }
interface Props { keyword: string; }

const rowLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--color-muted)',
  width: 44,
  flexShrink: 0,
  paddingTop: 7,
};

export default function AhrefsTool({ keyword }: Props) {
  const [country, setCountry] = useState('us');
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (items) => {
      const last = items[STORAGE_KEY] as Last | undefined;
      if (last?.country) setCountry(last.country);
    });
  }, []);

  const options = [...COUNTRIES.map((c) => ({ value: c.code, label: c.label })), { value: '__custom', label: '自定义…' }];

  function open() {
    try {
      const url = buildAhrefsUrl(country, keyword);
      chrome.storage.local.set({ [STORAGE_KEY]: { country } });
      chrome.tabs.create({ url });
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const canOpen = !keyword.trim() || !isValidCountryCode(country);

  return (
    <ToolPanel
      logo={<AhrefsLogo size={18} />}
      title="Ahrefs"
      subtitle="关键词难度查询"
      action={<Button onClick={open} disabled={canOpen}>打开查询</Button>}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
        <span style={rowLabelStyle}>国家</span>
        <Select
          value={country}
          options={options}
          onChange={(e) => {
            if (e.target.value === '__custom') { setCustom(true); setCountry(''); }
            else { setCustom(false); setCountry(e.target.value); }
          }}
          style={{ flex: 1, width: 'auto' }}
        />
      </div>
      {custom && (
        <TextInput
          value={country}
          placeholder="两位代码,如 us"
          onChange={(e) => setCountry(e.target.value)}
          style={{ marginTop: 8 }}
        />
      )}
      {error && <div style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 6 }}>{error}</div>}
    </ToolPanel>
  );
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `pnpm test tests/ahrefs-tool.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/pages/AhrefsTool.tsx tests/ahrefs-tool.test.tsx
git commit -m "refactor(keyword-tools): AhrefsTool 紧凑布局(打开查询上提 header、国家单行)"
```

---

### Task 6: GoogleTrendsTool 紧凑布局

**Files:**
- Modify: `entrypoints/sidepanel/pages/GoogleTrendsTool.tsx`
- Test: `tests/trends-tool.test.tsx`(新建)

**Interfaces:**
- Consumes: Task 2 的 `GoogleTrendsLogo`、Task 3 的 `ToolPanel.action`。
- Produces: 「搜索」按钮上提 action;对比词单行;天数/地区两列并排。

- [ ] **Step 1: 写失败测试(回归保护)**

创建 `tests/trends-tool.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GoogleTrendsTool from '../entrypoints/sidepanel/pages/GoogleTrendsTool';

describe('GoogleTrendsTool', () => {
  it('渲染「搜索」按钮与对比词/天数/地区控件', () => {
    const { container } = render(<GoogleTrendsTool keyword="apple" />);
    expect(screen.getByText('搜索')).toBeTruthy();
    expect(screen.getByText('对比词')).toBeTruthy();
    expect(screen.getByText('天数')).toBeTruthy();
    expect(screen.getByText('地区')).toBeTruthy();
    expect(container.querySelectorAll('select').length).toBe(2);
  });

  it('点「搜索」打开 trends 页(回归)', () => {
    const tabsCreate = vi.spyOn(chrome.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    render(<GoogleTrendsTool keyword="apple" />);
    fireEvent.click(screen.getByText('搜索'));
    expect(tabsCreate).toHaveBeenCalled();
    expect(tabsCreate.mock.calls[0][0].url).toContain('trends.google.com');
  });

  it('关键词为空时按钮禁用', () => {
    render(<GoogleTrendsTool keyword="" />);
    expect((screen.getByText('搜索').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `pnpm test tests/trends-tool.test.tsx`
Expected: 部分用例当前实现即可通过(回归类);布局类(`select` 数量为 2)当前也是 2。若全过,直接进 Step 3,Step 4 必须仍 PASS。

- [ ] **Step 3: 重排布局**

把 `entrypoints/sidepanel/pages/GoogleTrendsTool.tsx` 整体替换为:

```tsx
import { useEffect, useState } from 'react';
import Button from '../components/Button';
import Select from '../components/Select';
import Combobox from '../components/Combobox';
import ToolPanel from '../components/ToolPanel';
import { GoogleTrendsLogo } from '../components/brand-logos';
import { TRENDS_DATE_RANGES, TRENDS_GEOS, buildTrendsUrl } from '@lib/trends/url';

const STORAGE_KEY = 'kw-tools:trends';
const COMPARE_PRESETS = ['gpts', 'chatgpt', 'ai', 'ai tools'];

interface Props { keyword: string; }
interface Last { date: string; compare: string; geo: string; }

const colLabelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 };
const rowLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--color-muted)',
  width: 56,
  flexShrink: 0,
  paddingTop: 7,
};

export default function GoogleTrendsTool({ keyword }: Props) {
  const [date, setDate] = useState<string>('today 1-m');
  const [compare, setCompare] = useState<string>('gpts');
  const [geo, setGeo] = useState<string>('Worldwide');

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (items) => {
      const last = items[STORAGE_KEY] as Partial<Last> | undefined;
      if (last) {
        if (typeof last.date === 'string') setDate(last.date);
        if (typeof last.compare === 'string') setCompare(last.compare);
        if (typeof last.geo === 'string') setGeo(last.geo);
      }
    });
  }, []);

  function persist(patch: Partial<Last>) {
    chrome.storage.local.set({ [STORAGE_KEY]: { date, compare, geo, ...patch } });
  }

  function open() {
    const url = buildTrendsUrl(keyword, compare, date, geo);
    chrome.storage.local.set({ [STORAGE_KEY]: { date, compare, geo } });
    chrome.tabs.create({ url });
  }

  return (
    <ToolPanel
      logo={<GoogleTrendsLogo size={18} />}
      title="Google Trends"
      subtitle="谷歌趋势"
      action={<Button onClick={open} disabled={!keyword.trim()}>搜索</Button>}
    >
      {/* 对比词:标签 + Combobox 同行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
        <span style={rowLabelStyle}>对比词</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Combobox
            value={compare}
            options={COMPARE_PRESETS}
            placeholder="如 gpts,可留空"
            onChange={(v) => { setCompare(v); persist({ compare: v }); }}
          />
        </div>
      </div>
      {/* 天数 + 地区:两列并排 */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={colLabelStyle}>天数</div>
          <Select
            value={date}
            options={TRENDS_DATE_RANGES.map((d) => ({ value: d.value, label: d.label }))}
            onChange={(e) => { setDate(e.target.value); persist({ date: e.target.value }); }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={colLabelStyle}>地区</div>
          <Select
            value={geo}
            options={TRENDS_GEOS.map((g) => ({ value: g.value, label: g.label }))}
            onChange={(e) => { setGeo(e.target.value); persist({ geo: e.target.value }); }}
          />
        </div>
      </div>
    </ToolPanel>
  );
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `pnpm test tests/trends-tool.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/pages/GoogleTrendsTool.tsx tests/trends-tool.test.tsx
git commit -m "refactor(keyword-tools): GoogleTrendsTool 紧凑布局(搜索上提 header、天数/地区并排)"
```

---

### Task 7: QuickSearchTool geo 归属 Google

**Files:**
- Modify: `entrypoints/sidepanel/pages/QuickSearchTool.tsx`
- Test: `tests/quicksearch-tool.test.tsx`(新建)

**Interfaces:**
- Consumes: Task 2 的 `GoogleLogo`/`BingLogo`;`@lib/quicksearch/geo` 的 `getGeoPref`/`setGeoPref`/`GEO_REGIONS`/`GEO_OFF`(不变)。
- Produces: geo 下拉从面板顶部下沉到 Google 按钮所在左列,加「位置(仅 Google)」小字;Bing 按钮独立右列,与 Google 按钮底对齐。消除 geo 影响 Bing 的歧义。

- [ ] **Step 1: 写失败测试**

创建 `tests/quicksearch-tool.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuickSearchTool from '../entrypoints/sidepanel/pages/QuickSearchTool';

describe('QuickSearchTool', () => {
  it('渲染「位置(仅 Google)」提示,消除 geo 对 Bing 的歧义', () => {
    render(<QuickSearchTool keyword="apple" />);
    expect(screen.getByText(/仅 Google/)).toBeTruthy();
  });

  it('渲染 Google 与 Bing 两个搜索按钮', () => {
    render(<QuickSearchTool keyword="apple" />);
    expect(screen.getByText('用 Google 搜')).toBeTruthy();
    expect(screen.getByText('用 Bing 搜')).toBeTruthy();
  });

  it('切换搜索位置写入 storage(kw-tools:geo,回归保护)', async () => {
    const { container } = render(<QuickSearchTool keyword="apple" />);
    const select = container.querySelector('select')!;
    fireEvent.change(select, { target: { value: 'DE' } });
    const items = await chrome.storage.local.get('kw-tools:geo');
    expect(items['kw-tools:geo']).toMatchObject({ code: 'DE' });
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `pnpm test tests/quicksearch-tool.test.tsx`
Expected: FAIL(第一个用例失败:当前无「仅 Google」文本)。

- [ ] **Step 3: 重排为两列布局,geo 归属 Google**

把 `entrypoints/sidepanel/pages/QuickSearchTool.tsx` 整体替换为:

```tsx
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
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `pnpm test tests/quicksearch-tool.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/pages/QuickSearchTool.tsx tests/quicksearch-tool.test.tsx
git commit -m "refactor(keyword-tools): 快捷搜索 geo 下沉归属 Google 按钮,消除对 Bing 的歧义"
```

---

### Task 8: 全量验证

**Files:**
- 无文件改动;仅运行验证。

- [ ] **Step 1: 全量类型检查**

Run: `pnpm compile`
Expected: 无错误输出,退出码 0。若报 `Cannot find module '../assets/logos/xxx.png'`,确认 Task 1 的文件存在且路径正确。

- [ ] **Step 2: 全量测试**

Run: `pnpm test`
Expected: 所有测试套件通过,含新增 5 个 `.tsx` 套件与现有 url/geo/flow 套件。

- [ ] **Step 3: 构建**

Run: `pnpm build`
Expected: WXT 构建成功,`.output/chrome-mv3/` 产物更新,无报错。

- [ ] **Step 4: 手动验证(在浏览器)**

`pnpm dev` 加载扩展,打开 sidepanel → 关键词工具 tab,逐项核对:
1. 首行无「关键词工具」标题(TabBar 已有)。
2. 三张卡一屏可见(约 11 行),无需滚动。
3. Ahrefs:「打开查询」在 header 右;国家标签与下拉同一行。
4. Google Trends:「搜索」在 header 右;对比词一行;天数/地区并排。
5. 快捷搜索:「位置(仅 Google)」小字 + geo 下拉紧贴 Google 按钮上方;Bing 按钮独立右侧,与 Google 按钮底对齐。
6. 四个 logo 是真实品牌图、等大不变形。
7. 功能回归:切换 geo → 点「用 Google 搜」→ 结果反映目标国家;Ahrefs 自定义国家;Trends 各下拉;Bing 搜索均正常。

- [ ] **Step 5: 若 Step 1-3 有任何修复,Commit**

```bash
git add -A
git commit -m "fix(keyword-tools): 全量验证修复"
```
(若无需修复,跳过此步。)

---

## Self-Review 结论

- **Spec 覆盖**:spec 四个目标(删 h2 / 紧凑布局 / geo 归属 / 真实 logo)分别由 Task 4、Task 5+6、Task 7、Task 1+2 落地;`ToolPanel.action` 由 Task 3 提供基础设施。YAGNI 边界(不改 Select/Button/tokens、不碰其他 tab)在 Global Constraints 与各 Task 范围中明确。
- **类型一致性**:`ToolPanel.action` 在 Task 3 定义、Task 5/6 消费,签名一致;`brand-logos` 四个导出 + `size` 签名 Task 2 定义、Task 5/6/7 消费,保持不变;`setGeoPref`/`getGeoPref` 等 geo 接口沿用 `@lib/quicksearch/geo` 现有签名。
- **无占位符**:每个 Step 含完整代码或确切命令与预期输出。Task 5/6 Step 2 诚实标注「回归类用例当前实现也可能通过」,并要求 Step 4 必须 PASS,避免虚假 FAIL。
- **TDD 务实**:纯样式(flex 并排、间距)不写无意义断言;测试聚焦组件接口(action、logo img、geo 归属提示)与回归保护(tabs.create 调用、storage 写入、按钮禁用态)。
