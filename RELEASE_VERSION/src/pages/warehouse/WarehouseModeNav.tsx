import { useMemo } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { Activity, Boxes, Compass, SendHorizontal } from 'lucide-react';
import styles from './Warehouse.module.css';

const MODES = [
  { to: '/warehouse', label: 'Foundation', Icon: Boxes },
  { to: '/warehouse/twin', label: 'Twin', Icon: Compass },
  { to: '/warehouse/operations', label: 'Operations', Icon: SendHorizontal },
  { to: '/warehouse/control-tower', label: 'Control Tower', Icon: Activity },
] as const;

export function WarehouseModeNav() {
  const [searchParams] = useSearchParams();
  const sharedSearch = useMemo(() => {
    const next = new URLSearchParams();
    const site = searchParams.get('site');
    const draft = searchParams.get('draft');
    if (site) next.set('site', site);
    if (draft) next.set('draft', draft);
    const serialized = next.toString();
    return serialized ? `?${serialized}` : '';
  }, [searchParams]);

  return (
    <div className={styles.tabs} style={{ width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
      {MODES.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={{ pathname: to, search: sharedSearch }}
          className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
          style={{ textDecoration: 'none' }}
        >
          <Icon size={13} />
          {label}
        </NavLink>
      ))}
    </div>
  );
}
