import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCommandPalette } from './commandPalette';
import { useAuthStore } from './auth';
import {
  getDocument,
  getWindow,
  readStorage,
  writeStorage,
} from '../lib/browser';

export type Theme = 'dark' | 'light' | 'system';
export type ThemePack = 'neutral' | 'graphite' | 'sand' | 'obsidian' | 'enterprise';

type ActionRequest<T = undefined> = {
  nonce: number;
  payload: T;
};

type CreateDealPayload = {
  customerId?: string;
  title?: string;
};

type CreateTaskPayload = {
  customerId?: string;
  title?: string;
};

interface UIStore {
  theme: Theme;
  themePack: ThemePack;
  sidebarCollapsed: boolean;
  focusMode: boolean;
  workspaceAddMenuOpen: boolean;
  createCustomerRequest: ActionRequest<undefined>;
  createDealRequest: ActionRequest<CreateDealPayload | undefined>;
  createTaskRequest: ActionRequest<CreateTaskPayload | undefined>;
  assistantPromptRequest: ActionRequest<string | undefined>;
  setTheme: (t: Theme) => void;
  setThemePack: (pack: ThemePack) => void;
  toggleSidebar: () => void;
  toggleFocusMode: () => void;
  openWorkspaceAddMenu: () => void;
  closeWorkspaceAddMenu: () => void;
  openCreateCustomer: () => void;
  openCreateDeal: (payload?: CreateDealPayload) => void;
  openCreateTask: (payload?: CreateTaskPayload) => void;
  openAssistantPrompt: (prompt?: string) => void;
  openCommandPalette: () => void;
}

type AppearanceState = {
  theme: Theme;
  themePack: ThemePack;
};

type StoredAppearanceMap = Record<string, Partial<AppearanceState>>;

const UI_STORAGE_KEY = 'kort-ui';
const APPEARANCE_STORAGE_KEY = 'kort-ui:appearance-by-user';
const DEFAULT_APPEARANCE: AppearanceState = {
  theme: 'system',
  themePack: 'neutral',
};

let systemMQCleanup: (() => void) | null = null;

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isThemePack(value: unknown): value is ThemePack {
  return value === 'neutral'
    || value === 'graphite'
    || value === 'sand'
    || value === 'obsidian'
    || value === 'enterprise';
}

function normalizeAppearance(value: unknown): AppearanceState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const theme = isTheme(record.theme) ? record.theme : DEFAULT_APPEARANCE.theme;
  const themePack = isThemePack(record.themePack) ? record.themePack : DEFAULT_APPEARANCE.themePack;
  return { theme, themePack };
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readStoredAppearanceMap(): StoredAppearanceMap {
  const parsed = parseJson<StoredAppearanceMap>(readStorage(APPEARANCE_STORAGE_KEY));
  if (!parsed || typeof parsed !== 'object') {
    return {};
  }

  return parsed;
}

function writeStoredAppearanceMap(value: StoredAppearanceMap) {
  writeStorage(APPEARANCE_STORAGE_KEY, JSON.stringify(value));
}

function readLegacyAppearance(): AppearanceState | null {
  const parsed = parseJson<{ state?: unknown }>(readStorage(UI_STORAGE_KEY));
  return normalizeAppearance((parsed?.state as Record<string, unknown> | undefined) ?? parsed);
}

function readAppearanceForUser(userId: string | null, allowLegacyFallback = false): AppearanceState {
  if (!userId) {
    return DEFAULT_APPEARANCE;
  }

  const stored = normalizeAppearance(readStoredAppearanceMap()[userId]);
  if (stored) {
    return stored;
  }

  if (allowLegacyFallback) {
    return readLegacyAppearance() ?? DEFAULT_APPEARANCE;
  }

  return DEFAULT_APPEARANCE;
}

function persistAppearanceForUser(userId: string | null, appearance: AppearanceState) {
  if (!userId) {
    return;
  }

  const next = readStoredAppearanceMap();
  next[userId] = appearance;
  writeStoredAppearanceMap(next);
}

function resolveSystemTheme(): 'dark' | 'light' {
  const mq = getWindow()?.matchMedia?.('(prefers-color-scheme: dark)');
  return mq?.matches ? 'dark' : 'light';
}

function bindSystemThemeListener(handler: (resolvedTheme: 'dark' | 'light') => void) {
  const mq = getWindow()?.matchMedia?.('(prefers-color-scheme: dark)');
  if (!mq) {
    return null;
  }

  const listener = (event: MediaQueryListEvent) => {
    handler(event.matches ? 'dark' : 'light');
  };

  if ('addEventListener' in mq) {
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }

  const legacyMq = mq as MediaQueryList & {
    addListener?: (callback: (event: MediaQueryListEvent) => void) => void;
    removeListener?: (callback: (event: MediaQueryListEvent) => void) => void;
  };

  legacyMq.addListener?.(listener);
  return () => legacyMq.removeListener?.(listener);
}

function applyResolvedTheme(resolvedTheme: 'dark' | 'light', theme: Theme, pack: ThemePack) {
  const root = getDocument()?.documentElement;
  if (!root) {
    return;
  }

  root.setAttribute('data-theme', resolvedTheme);
  root.setAttribute('data-theme-mode', theme);
  root.setAttribute('data-theme-pack', pack);
  root.style.colorScheme = resolvedTheme;
}

function applyTheme(theme: Theme, pack: ThemePack = 'neutral', animate = true) {
  const root = getDocument()?.documentElement;
  if (!root) {
    return;
  }

  if (animate) {
    root.classList.add('theme-transitioning');
    setTimeout(() => root.classList.remove('theme-transitioning'), 220);
  }

  if (systemMQCleanup) {
    systemMQCleanup();
    systemMQCleanup = null;
  }

  if (theme === 'system') {
    applyResolvedTheme(resolveSystemTheme(), theme, pack);
    systemMQCleanup = bindSystemThemeListener((resolvedTheme) => {
      applyResolvedTheme(resolvedTheme, theme, pack);
    });
    return;
  }

  applyResolvedTheme(theme, theme, pack);
}

const initialUserId = useAuthStore.getState().user?.id ?? null;
const initialAppearance = readAppearanceForUser(initialUserId, true);

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      theme: initialAppearance.theme,
      themePack: initialAppearance.themePack,
      sidebarCollapsed: false,
      focusMode: false,
      workspaceAddMenuOpen: false,
      createCustomerRequest: { nonce: 0, payload: undefined },
      createDealRequest: { nonce: 0, payload: undefined },
      createTaskRequest: { nonce: 0, payload: undefined },
      assistantPromptRequest: { nonce: 0, payload: undefined },
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme, get().themePack);
        persistAppearanceForUser(useAuthStore.getState().user?.id ?? null, {
          theme,
          themePack: get().themePack,
        });
      },
      setThemePack: (themePack) => {
        set({ themePack });
        applyTheme(get().theme, themePack);
        persistAppearanceForUser(useAuthStore.getState().user?.id ?? null, {
          theme: get().theme,
          themePack,
        });
      },
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
      openWorkspaceAddMenu: () => set({ workspaceAddMenuOpen: true }),
      closeWorkspaceAddMenu: () => set({ workspaceAddMenuOpen: false }),
      openCreateCustomer: () => set((state) => ({
        createCustomerRequest: { nonce: state.createCustomerRequest.nonce + 1, payload: undefined },
      })),
      openCreateDeal: (payload) => set((state) => ({
        createDealRequest: { nonce: state.createDealRequest.nonce + 1, payload },
      })),
      openCreateTask: (payload) => set((state) => ({
        createTaskRequest: { nonce: state.createTaskRequest.nonce + 1, payload },
      })),
      openAssistantPrompt: (prompt) => set((state) => ({
        assistantPromptRequest: { nonce: state.assistantPromptRequest.nonce + 1, payload: prompt },
      })),
      openCommandPalette: () => useCommandPalette.getState().open(),
    }),
    {
      name: UI_STORAGE_KEY,
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        focusMode: state.focusMode,
      }),
    },
  ),
);

const win = getWindow();
if (win) {
  applyTheme(initialAppearance.theme, initialAppearance.themePack, false);

  if (initialUserId) {
    persistAppearanceForUser(initialUserId, initialAppearance);
  }

  let lastUserId = initialUserId;
  useAuthStore.subscribe((authState) => {
    const nextUserId = authState.user?.id ?? null;
    if (nextUserId === lastUserId) {
      return;
    }

    lastUserId = nextUserId;
    const appearance = readAppearanceForUser(nextUserId);
    useUIStore.setState({
      theme: appearance.theme,
      themePack: appearance.themePack,
    });
    applyTheme(appearance.theme, appearance.themePack, false);
  });
}
