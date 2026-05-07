import { useEffect } from 'react';
import { getDocument, getWindow } from '../lib/browser';

const COUNT_KEY = 'kortLockCount';
const STORE_KEY = 'kortLockStore';

interface LockSnapshot {
  overflow: string;
  paddingRight: string;
  position: string;
  top: string;
  width: string;
  scrollY: number;
  iosLock: boolean;
}

function isIOS(): boolean {
  const win = getWindow();
  if (!win) return false;
  if (!win.matchMedia('(pointer: coarse)').matches) return false;
  return /iPad|iPhone|iPod/.test(win.navigator.userAgent);
}

function applyLock(): void {
  const doc = getDocument();
  const win = getWindow();
  if (!doc || !win) return;

  const body = doc.body;
  const html = doc.documentElement;
  const scrollbarWidth = win.innerWidth - html.clientWidth;
  const ios = isIOS();
  const scrollY = win.scrollY;

  const snapshot: LockSnapshot = {
    overflow:     body.style.overflow,
    paddingRight: body.style.paddingRight,
    position:     body.style.position,
    top:          body.style.top,
    width:        body.style.width,
    scrollY,
    iosLock:      ios,
  };
  (body as HTMLElement & { [STORE_KEY]?: LockSnapshot })[STORE_KEY] = snapshot;

  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

  if (ios) {
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
  }
}

function releaseLock(): void {
  const doc = getDocument();
  const win = getWindow();
  if (!doc || !win) return;

  const body = doc.body;
  const snap = (body as HTMLElement & { [STORE_KEY]?: LockSnapshot })[STORE_KEY];
  if (!snap) return;

  body.style.overflow     = snap.overflow;
  body.style.paddingRight = snap.paddingRight;

  if (snap.iosLock) {
    body.style.position = snap.position;
    body.style.top      = snap.top;
    body.style.width    = snap.width;
    win.scrollTo(0, snap.scrollY);
  }

  delete (body as HTMLElement & { [STORE_KEY]?: LockSnapshot })[STORE_KEY];
}

/**
 * Reference-counted body scroll lock.
 * Coexists with Drawer.tsx (which uses `kortDrawerCount` for a different flag).
 * iOS Safari needs the fixed-position trick to actually stop the body from scrolling
 * behind a sheet — `overflow: hidden` alone is ignored on iOS.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const doc = getDocument();
    if (!doc) return;

    const body = doc.body;
    const before = Number(body.dataset[COUNT_KEY] ?? '0');
    const next = before + 1;
    body.dataset[COUNT_KEY] = String(next);

    if (before === 0) applyLock();

    return () => {
      const remaining = Number(body.dataset[COUNT_KEY] ?? '1') - 1;
      if (remaining > 0) {
        body.dataset[COUNT_KEY] = String(remaining);
        return;
      }
      delete body.dataset[COUNT_KEY];
      releaseLock();
    };
  }, [active]);
}
