import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { KortLogo } from '../../shared/ui/KortLogo';
import styles from './LockedChrome.module.css';

function getCurrentLabel(pathname: string) {
  if (pathname === '/' || pathname === '/dashboard') return 'Главная';
  const parts = pathname.split('/').filter(Boolean);
  const raw = (parts.length > 0 ? parts[parts.length - 1] : undefined) ?? 'Главная';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Locked shell chrome.
 * Пока workspace заблокирован, рендерим минимальные Topbar/Sidebar без интерактивных элементов.
 * После unlock AppShell переключается обратно на обычные Topbar/Sidebar.
 */
export function LockedTopbar() {
  const location = useLocation();
  const currentLabel = useMemo(() => getCurrentLabel(location.pathname), [location.pathname]);

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <div className={styles.breadcrumb}>
          <span className={styles.crumbRoot}>KORT</span>
          <span className={styles.crumbSep}>›</span>
          <span className={styles.crumbCurrent}>{currentLabel}</span>
        </div>
      </div>
      <div className={styles.topbarGhost} aria-hidden="true" />
    </header>
  );
}

/**
 * Locked shell chrome.
 * Намеренно оставляет только каркас левой рейки, без открытия навигации и дополнительных действий.
 */
export function LockedSidebar() {
  return (
    <aside className={styles.sidebar} aria-label="Боковая панель">
      <div className={styles.logoWrap}>
        <KortLogo size={36} />
      </div>
      <div className={styles.railSpacer} />
      <div className={styles.ghostSlot} aria-hidden="true" />
    </aside>
  );
}
