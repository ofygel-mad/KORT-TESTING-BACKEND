import type { CSSProperties } from 'react';
import styles from './KortLogo.module.css';

interface KortLogoProps {
  size?: number;
  style?: CSSProperties;
}

export function KortLogo({ size = 32, style }: KortLogoProps) {
  return (
    <img
      src="/logo2.ico"
      alt="Kort"
      width={size}
      height={size}
      className={styles.logo}
      style={{ '--logo-size': `${size}px`, ...style } as CSSProperties}
    />
  );
}
