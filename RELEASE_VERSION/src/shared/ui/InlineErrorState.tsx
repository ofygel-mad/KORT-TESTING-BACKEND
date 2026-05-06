import { AlertTriangle } from 'lucide-react';
import styles from './InlineErrorState.module.css';

interface InlineErrorStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function InlineErrorState({
  title = 'Не удалось загрузить данные',
  description = 'Проверьте соединение или попробуйте обновить экран.',
  action,
}: InlineErrorStateProps) {
  return (
    <div className={styles.root} role="alert" aria-live="polite">
      <div className={styles.iconWrap}>
        <AlertTriangle size={16} />
      </div>
      <div className={styles.copy}>
        <div className={styles.title}>{title}</div>
        <div className={styles.description}>{description}</div>
      </div>
      {action && (
        <button className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
