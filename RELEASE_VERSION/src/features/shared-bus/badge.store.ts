/**
 * src/features/shared-bus/badge.store.ts
 *
 * Глобальный счётчик непрочитанных событий на плитках рабочего стола.
 * Persisted — бейдж выживает после перезагрузки страницы.
 *
 * Правила:
 *   — Лиды:   +1 при каждом новом addLead()
 *   — Сделки: +1 при createFromLead() (новая карточка в воронке)
 *   — Задачи: +1 при createTask(); сброс при moveStatus('done') ИЛИ deleteTask()
 *             (НЕ при просто открытии плитки)
 *
 * Все прочие плитки (reports, imports, chapan) — бейдж не используется.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkspaceWidgetKind } from '../workspace/model/types';

type BadgeMap = Partial<Record<WorkspaceWidgetKind, number>>;

interface BadgeState {
  badges: BadgeMap;
  /** Добавить N к счётчику плитки */
  incrementBadge: (kind: WorkspaceWidgetKind, by?: number) => void;
  /** Обнулить счётчик плитки */
  clearBadge: (kind: WorkspaceWidgetKind) => void;
  /** Уменьшить счётчик на N (но не ниже 0) — для задач при done/delete */
  decrementBadge: (kind: WorkspaceWidgetKind, by?: number) => void;
  /** Прочитать счётчик */
  getBadge: (kind: WorkspaceWidgetKind) => number;
}

export const useBadgeStore = create<BadgeState>()(
  persist(
    (set, get) => ({
      badges: {},

      incrementBadge: (kind, by = 1) =>
        set(s => ({
          badges: { ...s.badges, [kind]: (s.badges[kind] ?? 0) + by },
        })),

      clearBadge: (kind) =>
        set(s => {
          const next = { ...s.badges };
          delete next[kind];
          return { badges: next };
        }),

      decrementBadge: (kind, by = 1) =>
        set(s => {
          const cur = s.badges[kind] ?? 0;
          const next = Math.max(0, cur - by);
          const map = { ...s.badges };
          if (next === 0) delete map[kind]; else map[kind] = next;
          return { badges: map };
        }),

      getBadge: (kind) => get().badges[kind] ?? 0,
    }),
    {
      name: 'kort-tile-badges',
      partialize: (s) => ({ badges: s.badges }),
    },
  ),
);
