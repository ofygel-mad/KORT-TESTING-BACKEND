import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OnlineStatus = 'online' | 'away' | 'offline';

export const ONLINE_STATUSES: Array<{ key: OnlineStatus; label: string; color: string }> = [
  { key: 'online',  label: 'Онлайн',  color: '#10B981' },
  { key: 'away',    label: 'Отошёл',  color: '#F59E0B' },
  { key: 'offline', label: 'Офлайн',  color: '#6B7280' },
];

type ProfilePrefsState = {
  onlineStatus: OnlineStatus;
  lastActivityAt: number;
  setOnlineStatus: (status: OnlineStatus) => void;
  updateLastActivity: () => void;
};

const AUTO_AWAY_AFTER_MS = 15 * 60 * 1000; // 15 минут неактивности → away
const AUTO_OFFLINE_AFTER_MS = 60 * 60 * 1000; // 60 минут неактивности → offline

export const useProfileStore = create<ProfilePrefsState>()(
  persist(
    (set, get) => ({
      onlineStatus: 'online',
      lastActivityAt: Date.now(),

      setOnlineStatus: (status) => set({ onlineStatus: status }),

      updateLastActivity: () => {
        const now = Date.now();
        const state = get();

        // Обновляем время последней активности
        set({ lastActivityAt: now });

        // Если был away/offline, но активен сейчас → online
        if (state.onlineStatus !== 'online') {
          set({ onlineStatus: 'online' });
        }
      },
    }),
    { name: 'kort-profile-prefs' },
  ),
);

// Хук для отслеживания активности пользователя
export function useActivityTracker() {
  const updateLastActivity = useProfileStore((s) => s.updateLastActivity);

  // Отслеживаем клики, движения мыши и нажатия клавиш
  const handleActivity = () => {
    updateLastActivity();
  };

  // На маунте добавляем listeners, на анмаунте удаляем
  if (typeof window !== 'undefined') {
    window.addEventListener('click', handleActivity);
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }
}

// Вычисляем текущий статус на основе времени последней активности
export function getComputedOnlineStatus(lastActivityAt: number, manualStatus: OnlineStatus): OnlineStatus {
  // Если пользователь явно установил offline, уважаем его выбор
  if (manualStatus === 'offline') {
    return 'offline';
  }

  const now = Date.now();
  const timeSinceActivity = now - lastActivityAt;

  if (timeSinceActivity > AUTO_OFFLINE_AFTER_MS) {
    return 'offline';
  } else if (timeSinceActivity > AUTO_AWAY_AFTER_MS) {
    return 'away';
  } else {
    return 'online';
  }
}
