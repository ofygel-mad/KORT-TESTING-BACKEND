import { getNavigator, getWindow } from './browser';

type HapticPattern = number | number[];

function reducedMotion(): boolean {
  const win = getWindow();
  if (!win || typeof win.matchMedia !== 'function') return false;
  return win.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Fires a Vibration API pulse. No-ops on desktop, when the API is missing,
 * or when the user has prefers-reduced-motion. Safe to call from any handler.
 */
export function vibrate(pattern: HapticPattern): void {
  if (reducedMotion()) return;
  const nav = getNavigator() as (Navigator & { vibrate?: (p: HapticPattern) => boolean }) | undefined;
  if (!nav?.vibrate) return;
  try { nav.vibrate(pattern); } catch { /* ignore — denied by user agent */ }
}

/** Single light tap — primary action confirmation. */
export const hapticTap = () => vibrate(10);

/** Sheet snap commit / picker selection. */
export const hapticSelect = () => vibrate(6);

/** Success burst — order created, save committed. */
export const hapticSuccess = () => vibrate([10, 60, 20]);

/** Warning — destructive confirmation. */
export const hapticWarn = () => vibrate([12, 40, 12, 40, 12]);
