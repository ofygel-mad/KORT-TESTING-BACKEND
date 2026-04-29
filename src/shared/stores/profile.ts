import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OnlineStatus = 'online' | 'away' | 'offline';

export const ONLINE_STATUSES: Array<{ key: OnlineStatus; label: string; color: string }> = [
  { key: 'online',  label: '\u041e\u043d\u043b\u0430\u0439\u043d',  color: '#10B981' },
  { key: 'away',    label: '\u041e\u0442\u043e\u0448\u0451\u043b',  color: '#F59E0B' },
  { key: 'offline', label: '\u041e\u0444\u043b\u0430\u0439\u043d',  color: '#6B7280' },
];

type ProfilePrefsState = {
  onlineStatus: OnlineStatus;
  lastActivityAt: number;
  setOnlineStatus: (status: OnlineStatus) => void;
  updateLastActivity: () => void;
};

const AUTO_AWAY_AFTER_MS = 15 * 60 * 1000;
const AUTO_OFFLINE_AFTER_MS = 60 * 60 * 1000;

export const useProfileStore = create<ProfilePrefsState>()(
  persist(
    (set, get) => ({
      onlineStatus: 'online',
      lastActivityAt: Date.now(),

      setOnlineStatus: (status) => set({ onlineStatus: status }),

      updateLastActivity: () => {
        const now = Date.now();
        const state = get();

        set({ lastActivityAt: now });

        if (state.onlineStatus !== 'online') {
          set({ onlineStatus: 'online' });
        }
      },
    }),
    { name: 'kort-profile-prefs' },
  ),
);

export function useActivityTracker() {
  const updateLastActivity = useProfileStore((s) => s.updateLastActivity);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastUpdateRef.current < 30_000) {
        return;
      }

      lastUpdateRef.current = now;
      updateLastActivity();
    };

    window.addEventListener('click', handleActivity, { passive: true });
    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity, { passive: true });

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [updateLastActivity]);
}

export function getComputedOnlineStatus(lastActivityAt: number, manualStatus: OnlineStatus): OnlineStatus {
  if (manualStatus === 'offline') {
    return 'offline';
  }

  const now = Date.now();
  const timeSinceActivity = now - lastActivityAt;

  if (timeSinceActivity > AUTO_OFFLINE_AFTER_MS) {
    return 'offline';
  }

  if (timeSinceActivity > AUTO_AWAY_AFTER_MS) {
    return 'away';
  }

  return 'online';
}
