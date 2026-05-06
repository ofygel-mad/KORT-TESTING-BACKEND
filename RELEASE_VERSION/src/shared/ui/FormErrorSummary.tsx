import type { FieldErrors, FieldValues } from 'react-hook-form';
import styles from './FormErrorSummary.module.css';

interface Props<T extends FieldValues> {
  errors: FieldErrors<T>;
  title?: string;
}

export function FormErrorSummary<T extends FieldValues>({ errors, title = 'Проверьте форму' }: Props<T>) {
  const items = Object.values(errors)
    .map((error) => error?.message)
    .filter((message): message is string => typeof message === 'string' && message.length > 0);

  if (items.length === 0) return null;

  return (
    <div className={styles.root} role="alert" aria-live="assertive">
      <div className={styles.title}>{title}</div>
      <ul className={styles.list}>
        {items.map((message, index) => (
          <li key={`${message}-${index}`}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
