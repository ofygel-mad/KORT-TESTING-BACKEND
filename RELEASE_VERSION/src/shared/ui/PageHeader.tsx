import type { ReactNode } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import s from './PageHeader.module.css';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: Props) {
  const isMobile = useIsMobile();
  return (
    <div className={`${s.root} ${isMobile ? s.mobile : ''}`}>
      <div className={s.copy}>
        <div className={s.eyebrow}>Workspace section</div>
        <h1 className={`${s.title} ${isMobile ? s.titleMobile : ''}`}>{title}</h1>
        {subtitle && <p className={s.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={s.actions}>{actions}</div>}
    </div>
  );
}
