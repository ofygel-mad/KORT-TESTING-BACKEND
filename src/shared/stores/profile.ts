import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MoodKey =
  | 'none'
  | 'focused'
  | 'coffee'
  | 'fire'
  | 'chill'
  | 'away'
  | 'invisible';

export const MOODS: Array<{ key: MoodKey; emoji: string; label: string }> = [
  { key: 'none',      emoji: '',   label: 'Нет статуса' },
  { key: 'focused',   emoji: '🎯', label: 'В работе' },
  { key: 'coffee',    emoji: '☕', label: 'Перерыв' },
  { key: 'fire',      emoji: '🔥', label: 'Горю' },
  { key: 'chill',     emoji: '😎', label: 'Спокойно' },
  { key: 'away',      emoji: '🚶', label: 'Отошёл' },
  { key: 'invisible', emoji: '👻', label: 'Невидимый' },
];

type ProfilePrefsState = {
  mood: MoodKey;
  statusText: string;
  setMood: (mood: MoodKey) => void;
  setStatusText: (text: string) => void;
};

export const useProfileStore = create<ProfilePrefsState>()(
  persist(
    (set) => ({
      mood: 'none',
      statusText: '',
      setMood: (mood) => set({ mood }),
      setStatusText: (statusText) => set({ statusText }),
    }),
    { name: 'kort-profile-prefs' },
  ),
);
