import { useEffect, useState } from 'react';

type ViewportProfile = {
  width: number;
  height: number;
  isPhone: boolean;
  isTablet: boolean;
  pointerCoarse: boolean;
  keyboardInset: number;
};

function readProfile(): ViewportProfile {
  const vv = window.visualViewport;
  const width = Math.round(vv?.width ?? window.innerWidth);
  const height = Math.round(vv?.height ?? window.innerHeight);
  const pointerCoarse = window.matchMedia('(pointer: coarse)').matches;
  const keyboardInset = Math.max(0, window.innerHeight - height);

  return {
    width,
    height,
    isPhone: width < 768,
    isTablet: width < 981,
    pointerCoarse,
    keyboardInset,
  };
}

export function useViewportProfile() {
  const [profile, setProfile] = useState<ViewportProfile>(() => readProfile());

  useEffect(() => {
    const sync = () => {
      const next = readProfile();
      document.documentElement.style.setProperty('--vvh', `${next.height}px`);
      document.documentElement.style.setProperty('--vk-bottom', `${next.keyboardInset}px`);
      setProfile(next);
    };

    sync();
    window.addEventListener('resize', sync);
    window.visualViewport?.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    };
  }, []);

  return profile;
}
