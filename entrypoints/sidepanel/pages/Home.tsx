import Card from '../components/Card';
const TOOLS = [
  { key: 'gsc', title: 'GSC 批量提交', subtitle: '批量请求编入索引' },
  { key: 'ahrefs', title: 'Ahrefs KD 查询', subtitle: '关键词难度查询' },
  { key: 'projects', title: '项目管理', subtitle: '网站域名增删改' },
] as const;
export default function Home({ onNavigate }: { onNavigate: (r: 'gsc' | 'ahrefs' | 'projects') => void }) {
  return (
    <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {TOOLS.map((t) => (
        <Card key={t.key} title={t.title} subtitle={t.subtitle} onClick={() => onNavigate(t.key)} />
      ))}
    </div>
  );
}
