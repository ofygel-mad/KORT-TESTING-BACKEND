import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ProductionWorkspaceId = 'hub' | 'chapan' | 'template' | 'workspace';
export type ProductionTemplateSection = 'overview' | 'operations' | 'settings';

interface ProductionShellRecord {
  activeWorkspace: ProductionWorkspaceId;
  templateSection: ProductionTemplateSection;
  templateName: string;
  templateDescriptor: string;
  templateOrderPrefix: string;
  /** ID of a created workshop — populated after successful template submission */
  workshopId?: string;
}

interface PersistedProductionShellState {
  tiles?: Record<string, Partial<ProductionShellRecord>>;
}

interface ProductionShellState {
  tiles: Record<string, ProductionShellRecord>;
  ensureTile: (tileId: string) => void;
  openWorkspace: (tileId: string, workspace: ProductionWorkspaceId) => void;
  setTemplateSection: (tileId: string, section: ProductionTemplateSection) => void;
  setTemplateName: (tileId: string, name: string) => void;
  setTemplateDescriptor: (tileId: string, descriptor: string) => void;
  setTemplateOrderPrefix: (tileId: string, prefix: string) => void;
  setWorkshopId: (tileId: string, workshopId: string) => void;
  resetTemplate: (tileId: string) => void;
  clearTile: (tileId: string) => void;
}

const DEFAULT_RECORD: ProductionShellRecord = {
  activeWorkspace: 'hub',
  templateSection: 'overview',
  templateName: '',
  templateDescriptor: '',
  templateOrderPrefix: '',
};

function isWorkspaceId(value: unknown): value is ProductionWorkspaceId {
  return value === 'hub' || value === 'chapan' || value === 'template' || value === 'workspace';
}

function isTemplateSection(value: unknown): value is ProductionTemplateSection {
  return value === 'overview' || value === 'operations' || value === 'settings';
}

function sanitizeName(value: unknown) {
  return typeof value === 'string' ? value : DEFAULT_RECORD.templateName;
}

function sanitizeDescriptor(value: unknown) {
  return typeof value === 'string' ? value : DEFAULT_RECORD.templateDescriptor;
}

function sanitizePrefix(value: unknown) {
  return typeof value === 'string' ? value : DEFAULT_RECORD.templateOrderPrefix;
}

function ensureRecord(record?: Partial<ProductionShellRecord>): ProductionShellRecord {
  return {
    activeWorkspace: isWorkspaceId(record?.activeWorkspace) ? record.activeWorkspace : DEFAULT_RECORD.activeWorkspace,
    templateSection: isTemplateSection(record?.templateSection) ? record.templateSection : DEFAULT_RECORD.templateSection,
    templateName: sanitizeName(record?.templateName),
    templateDescriptor: sanitizeDescriptor(record?.templateDescriptor),
    templateOrderPrefix: sanitizePrefix(record?.templateOrderPrefix),
  };
}

function patchTileRecord(
  tiles: Record<string, ProductionShellRecord>,
  tileId: string,
  patch: Partial<ProductionShellRecord>,
) {
  return {
    ...tiles,
    [tileId]: ensureRecord({
      ...ensureRecord(tiles[tileId]),
      ...patch,
    }),
  };
}

export const useProductionShellStore = create<ProductionShellState>()(
  persist(
    (set) => ({
      tiles: {},
      ensureTile: (tileId) => set((state) => (
        state.tiles[tileId]
          ? state
          : { tiles: { ...state.tiles, [tileId]: ensureRecord() } }
      )),
      openWorkspace: (tileId, workspace) => set((state) => ({
        tiles: patchTileRecord(state.tiles, tileId, { activeWorkspace: workspace }),
      })),
      setTemplateSection: (tileId, templateSection) => set((state) => ({
        tiles: patchTileRecord(state.tiles, tileId, { templateSection }),
      })),
      setTemplateName: (tileId, templateName) => set((state) => ({
        tiles: patchTileRecord(state.tiles, tileId, { templateName }),
      })),
      setTemplateDescriptor: (tileId, templateDescriptor) => set((state) => ({
        tiles: patchTileRecord(state.tiles, tileId, { templateDescriptor }),
      })),
      setTemplateOrderPrefix: (tileId, templateOrderPrefix) => set((state) => ({
        tiles: patchTileRecord(state.tiles, tileId, { templateOrderPrefix }),
      })),
      setWorkshopId: (tileId, workshopId) => set((state) => ({
        tiles: patchTileRecord(state.tiles, tileId, { workshopId }),
      })),
      resetTemplate: (tileId) => set((state) => ({
        tiles: patchTileRecord(state.tiles, tileId, {
          templateSection: DEFAULT_RECORD.templateSection,
          templateName: DEFAULT_RECORD.templateName,
          templateDescriptor: DEFAULT_RECORD.templateDescriptor,
          templateOrderPrefix: DEFAULT_RECORD.templateOrderPrefix,
        }),
      })),
      clearTile: (tileId) => set((state) => {
        if (!state.tiles[tileId]) {
          return state;
        }

        const tiles = { ...state.tiles };
        delete tiles[tileId];
        return { tiles };
      }),
    }),
    {
      name: 'kort-production-shell',
      partialize: (state) => ({ tiles: state.tiles }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as PersistedProductionShellState;
        const tiles = Object.fromEntries(
          Object.entries(persisted.tiles ?? {}).map(([tileId, record]) => [tileId, ensureRecord(record)]),
        );

        return {
          ...currentState,
          tiles,
        };
      },
    },
  ),
);

export function useTileProductionShell(tileId: string) {
  const ensureTile = useProductionShellStore((state) => state.ensureTile);
  const record = useProductionShellStore((state) => state.tiles[tileId] ?? DEFAULT_RECORD);
  const openWorkspace = useProductionShellStore((state) => state.openWorkspace);
  const setTemplateSection = useProductionShellStore((state) => state.setTemplateSection);
  const setTemplateName = useProductionShellStore((state) => state.setTemplateName);
  const setTemplateDescriptor = useProductionShellStore((state) => state.setTemplateDescriptor);
  const setTemplateOrderPrefix = useProductionShellStore((state) => state.setTemplateOrderPrefix);
  const setWorkshopId = useProductionShellStore((state) => state.setWorkshopId);
  const resetTemplate = useProductionShellStore((state) => state.resetTemplate);

  useEffect(() => {
    ensureTile(tileId);
  }, [ensureTile, tileId]);

  return {
    ...record,
    openWorkspace: (workspace: ProductionWorkspaceId) => openWorkspace(tileId, workspace),
    goHome: () => openWorkspace(tileId, 'hub'),
    setTemplateSection: (section: ProductionTemplateSection) => setTemplateSection(tileId, section),
    setTemplateName: (name: string) => setTemplateName(tileId, name),
    setTemplateDescriptor: (descriptor: string) => setTemplateDescriptor(tileId, descriptor),
    setTemplateOrderPrefix: (prefix: string) => setTemplateOrderPrefix(tileId, prefix),
    setWorkshopId: (id: string) => setWorkshopId(tileId, id),
    resetTemplate: () => resetTemplate(tileId),
  };
}

export function clearTileProductionShell(tileId: string) {
  useProductionShellStore.getState().clearTile(tileId);
}
