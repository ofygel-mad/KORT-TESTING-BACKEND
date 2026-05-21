import { useEffect, useState } from 'react';
import { getDevicePerformanceProfile, getWindow, type DevicePerformanceProfile } from '../lib/browser';

function sameProfile(a: DevicePerformanceProfile, b: DevicePerformanceProfile): boolean {
  return a.tier === b.tier
    && a.reducedMotion === b.reducedMotion
    && a.hardwareConcurrency === b.hardwareConcurrency
    && a.deviceMemory === b.deviceMemory
    && a.maxPixelRatio === b.maxPixelRatio
    && a.antialias === b.antialias
    && a.enableBloom === b.enableBloom
    && a.preferMinimalMotion === b.preferMinimalMotion
    && a.flightProjectionIntervalMs === b.flightProjectionIntervalMs;
}

export function useDevicePerformance(): DevicePerformanceProfile {
  const [profile, setProfile] = useState(() => getDevicePerformanceProfile());

  useEffect(() => {
    const win = getWindow();
    if (!win || typeof win.matchMedia !== 'function') {
      return;
    }

    const media = win.matchMedia('(prefers-reduced-motion: reduce)');
    // Keep the SAME object reference unless the profile genuinely changes.
    // Returning a fresh-but-equal object would re-run every consumer effect —
    // including the one that tears down and rebuilds the whole WebGL scene.
    const sync = () => setProfile((prev) => {
      const next = getDevicePerformanceProfile();
      return sameProfile(prev, next) ? prev : next;
    });

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
