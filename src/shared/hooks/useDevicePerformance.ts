import { useEffect, useState } from 'react';
import { getDevicePerformanceProfile, getWindow, type DevicePerformanceProfile } from '../lib/browser';

export function useDevicePerformance(): DevicePerformanceProfile {
  const [profile, setProfile] = useState(() => getDevicePerformanceProfile());

  useEffect(() => {
    const win = getWindow();
    if (!win || typeof win.matchMedia !== 'function') {
      return;
    }

    const media = win.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setProfile(getDevicePerformanceProfile());
    sync();

    if ('addEventListener' in media) {
      media.addEventListener('change', sync);
      return () => media.removeEventListener('change', sync);
    }

    const legacyMedia = media as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    legacyMedia.addListener?.(sync);
    return () => legacyMedia.removeListener?.(sync);
  }, []);

  return profile;
}
