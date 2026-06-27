interface CardProps {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

/**
 * Card 以可点击区域呈现。
 *
 * 不能用 `<button>`：其内容包含块级（标题/副标题/children），HTML 规范禁止
 * `<button>` 内嵌交互式/块级内容。改为 `div[role=button]`，保留键盘可达性
 * （tabIndex + Enter/Space 触发 onClick），并保留原有 CSS 变量样式。
 */
export default function Card({ title, subtitle, onClick, children }: CardProps) {
  const interactive = !!onClick;
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick!();
              }
            }
          : undefined
      }
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'var(--color-surface-card)', color: 'var(--color-ink)',
        border: 'none', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)',
        cursor: interactive ? 'pointer' : 'default',
      }}
    >
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500 }}>{title}</div>
      {subtitle && <div style={{ color: 'var(--color-muted)', fontSize: 13, marginTop: 4 }}>{subtitle}</div>}
      {children}
    </div>
  );
}
