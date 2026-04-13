import { useState, useEffect } from 'react';
import { getWindow, isBrowser } from '../lib/browser';

export function useIsMobile(bp = 768) {
  const [v, setV] = useState(() => (isBrowser ? (getWindow()?.innerWidth ?? 1024) < bp : false));
  useEffect(() => {
    const win = getWindow();
    if (!win) return;
    const h = () => setV(win.innerWidth < bp);
    h();
    win.addEventListener('resize', h);
    return () => win.removeEventListener('resize', h);
  }, [bp]);
  return v;
}
