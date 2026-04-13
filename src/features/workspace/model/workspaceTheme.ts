import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WorkspaceBg =
  | 'grid'
  | 'bg01'
  | 'bg02'
  | 'bg03'
  | 'bg04'
  | 'bg05'
  | 'bg06'
  | 'bg07';

export interface WorkspaceBgDefinition {
  id: WorkspaceBg;
  label: string;
  description: string;
  /** CSS value used as static preview thumbnail in the theme modal. */
  previewColor: string;
}

export const WORKSPACE_BG_OPTIONS: WorkspaceBgDefinition[] = [
  { id: 'grid',  label: 'Сетка',      description: 'Дефолтный точечный фон',     previewColor: '' },
  { id: 'bg01',  label: 'Абстракция', description: 'Плавные цветовые волны',      previewColor: 'linear-gradient(135deg, #1a0a2e 0%, #2d1a6b 50%, #0a1a2e 100%)' },
  { id: 'bg02',  label: 'Туман',      description: 'Атмосферный медленный дрейф', previewColor: 'linear-gradient(135deg, #0f1623 0%, #1e2f45 50%, #0a0f1a 100%)' },
  { id: 'bg03',  label: 'Сияние',     description: 'Тихое звёздное движение',     previewColor: 'linear-gradient(135deg, #05081a 0%, #0a0f30 50%, #02030e 100%)' },
  { id: 'bg04',  label: 'Геометрия',  description: 'Анимированные формы',         previewColor: 'linear-gradient(135deg, #0a1414 0%, #0f2828 50%, #040a0a 100%)' },
  { id: 'bg05',  label: 'Огонь',      description: 'Тлеющие угли и свет',         previewColor: 'linear-gradient(135deg, #1f0600 0%, #3d1000 50%, #1a0500 100%)' },
  { id: 'bg06',  label: 'Матрица',    description: 'Цифровой поток данных',        previewColor: 'linear-gradient(135deg, #001500 0%, #003300 50%, #000a00 100%)' },
  { id: 'bg07',  label: 'Поток',      description: 'Медитативные волны',           previewColor: 'linear-gradient(135deg, #001a1a 0%, #003535 50%, #000e0e 100%)' },
];

interface WorkspaceThemeStore {
  activeBg: WorkspaceBg;
  setActiveBg: (bg: WorkspaceBg) => void;
}

function isWorkspaceBg(value: unknown): value is WorkspaceBg {
  return typeof value === 'string' && WORKSPACE_BG_OPTIONS.some((bg) => bg.id === value);
}

export const useWorkspaceTheme = create<WorkspaceThemeStore>()(
  persist(
    (set) => ({
      activeBg: 'grid',
      setActiveBg: (bg) => set({ activeBg: bg }),
    }),
    {
      name: 'kort-workspace-theme',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<WorkspaceThemeStore> | undefined;
        return {
          ...currentState,
          activeBg: isWorkspaceBg(persisted?.activeBg) ? persisted.activeBg : currentState.activeBg,
        };
      },
    },
  ),
);
