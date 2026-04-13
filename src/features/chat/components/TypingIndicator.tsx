import styles from './TypingIndicator.module.css';

interface Props {
  names: string[];
}

export function TypingIndicator({ names }: Props) {
  if (names.length === 0) return null;

  const label =
    names.length === 1
      ? `${names[0]} печатает`
      : names.length === 2
        ? `${names[0]} и ${names[1]} печатают`
        : `${names[0]} и ещё ${names.length - 1} печатают`;

  return (
    <div className={styles.root}>
      <div className={styles.dots}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
      <span className={styles.text}>{label}</span>
    </div>
  );
}
