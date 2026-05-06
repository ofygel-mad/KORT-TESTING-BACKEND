import { Sun, Moon, Monitor } from 'lucide-react';
import { useUIStore } from '../stores/ui';
import type { Theme } from '../stores/ui';
import styles from './ThemeSwitcher.module.css';

const OPTIONS: { key: Theme; Icon: React.ElementType; label: string }[] = [
  { key: 'system', Icon: Monitor, label: 'Системная' },
  { key: 'light',  Icon: Sun,     label: 'Светлая'   },
  { key: 'dark',   Icon: Moon,    label: 'Тёмная'    },
];

/**
 * Universal theme switcher — adapts visually to its context via CSS-variable
 * fallback chains:  --ch-* (ChapanShell)  →  global design tokens (AppShell).
 * Drop it anywhere; no extra props needed.
 */
export function ThemeSwitcher() {
  const theme    = useUIStore(s => s.theme);
  const setTheme = useUIStore(s => s.setTheme);

  return (
    <div className={styles.switcher} role="group" aria-label="Тема оформления">
      {OPTIONS.map(({ key, Icon, label }) => (
        <button
          key={key}
          className={`${styles.btn} ${theme === key ? styles.btnActive : ''}`}
          onClick={() => setTheme(key)}
          title={label}
          aria-label={label}
          aria-pressed={theme === key}
        >
          <Icon size={13} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}
