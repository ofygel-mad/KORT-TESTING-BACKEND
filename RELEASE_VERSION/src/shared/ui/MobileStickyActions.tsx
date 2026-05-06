import { ReactNode } from 'react';
import s from './MobileStickyActions.module.css';

export function MobileStickyActions({ children }: { children: ReactNode }) {
  return <div className={s.root}>{children}</div>;
}
