import { IconChevron } from './icons';

export interface ToolCardProps {
  icon?: React.ReactNode;
  logo?: string;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** 透传到根节点(如网格跨列: gridColumn '1 / -1')。 */
  style?: React.CSSProperties;
}

export default function ToolCard({ icon, logo, title, subtitle, onClick, disabled, style }: ToolCardProps) {
  const interactive = !!onClick && !disabled;
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-disabled={disabled || undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!(); } } : undefined}
      className={`tool-card${disabled ? ' is-disabled' : ''}`}
      style={{ opacity: disabled ? 0.5 : 1, ...style }}
    >
      <span className="tool-card__icon">
        {logo
          ? <img src={logo} width={18} height={18} alt="" aria-hidden="true" style={{ objectFit: 'contain', borderRadius: 4 }} />
          : icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="tool-card__title">{title}</span>
        {subtitle && <span className="tool-card__subtitle">{subtitle}</span>}
      </span>
      {onClick && !disabled && <IconChevron size={16} />}
    </div>
  );
}
