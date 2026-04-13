import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import s from './Breadcrumb.module.css';

interface Item {
  label: string;
  to?: string;
}

export function Breadcrumb({ items }: { items: Item[] }) {
  return (
    <nav className={s.nav}>
      {items.map((item, idx) => (
        <span key={idx} className={s.item}>
          {idx > 0 && <ChevronRight size={12} className={s.chevron} />}
          {item.to ? (
            <Link to={item.to} className={s.link}>
              {item.label}
            </Link>
          ) : (
            <span className={s.current}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
