import { nanoid } from 'nanoid';
import { create } from 'zustand';
import type { InviteContext, Membership, Org, User } from '../shared/stores/auth';
import type { ConsoleEventPayload, ConsoleFilter, ConsoleLogEntry } from './types';

const MAX_LOG_ENTRIES = 400;
const MAX_COMMAND_HISTORY = 60;

export type AuthSnapshot = {
  user: User | null;
  org: Org | null;
  token: string | null;
  refreshToken: string | null;
  role: string;
  capabilities: string[];
  membership: Membership;
  inviteContext: InviteContext | null;
  isUnlocked: boolean;
};

type ServiceSessionState = {
  active: boolean;
  activatedAt: string | null;
  snapshot: AuthSnapshot | null;
};

type ConsoleStore = {
  isOpen: boolean;
  entries: ConsoleLogEntry[];
  commandHistory: string[];
  filter: ConsoleFilter;
  serviceSession: ServiceSessionState;
  open: () => void;
  close: () => void;
  toggle: () => void;
  addEntry: (payload: ConsoleEventPayload) => void;
  clearEntries: () => void;
  pushCommand: (command: string) => void;
  setFilter: (patch: Partial<ConsoleFilter>) => void;
  resetFilter: () => void;
  setServiceSession: (state: Partial<ServiceSessionState>) => void;
  resetServiceSession: () => void;
};

export const DEFAULT_CONSOLE_FILTER: ConsoleFilter = {
  query: '',
  source: 'all',
  level: 'all',
};

export const useConsoleStore = create<ConsoleStore>()((set) => ({
  isOpen: false,
  entries: [],
  commandHistory: [],
  filter: DEFAULT_CONSOLE_FILTER,
  serviceSession: {
    active: false,
    activatedAt: null,
    snapshot: null,
  },
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  addEntry: (payload) => set((state) => {
    const nextEntry: ConsoleLogEntry = {
      id: nanoid(),
      timestamp: payload.timestamp ?? new Date().toISOString(),
      level: payload.level,
      source: payload.source,
      message: payload.message,
      details: payload.details,
      command: payload.command,
    };

    return {
      entries: [...state.entries, nextEntry].slice(-MAX_LOG_ENTRIES),
    };
  }),
  clearEntries: () => set({ entries: [] }),
  pushCommand: (command) => set((state) => ({
    commandHistory: [...state.commandHistory, command].slice(-MAX_COMMAND_HISTORY),
  })),
  setFilter: (patch) => set((state) => ({
    filter: {
      ...state.filter,
      ...patch,
    },
  })),
  resetFilter: () => set({ filter: DEFAULT_CONSOLE_FILTER }),
  setServiceSession: (patch) => set((state) => ({
    serviceSession: {
      ...state.serviceSession,
      ...patch,
    },
  })),
  resetServiceSession: () => set({
    serviceSession: {
      active: false,
      activatedAt: null,
      snapshot: null,
    },
  }),
}));

export function filterConsoleEntries(entries: ConsoleLogEntry[], filter: ConsoleFilter) {
  const normalizedQuery = filter.query.trim().toLowerCase();

  return entries.filter((entry) => {
    if (filter.source !== 'all' && entry.source !== filter.source) {
      return false;
    }

    if (filter.level !== 'all' && entry.level !== filter.level) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = `${entry.message}\n${entry.details ?? ''}\n${entry.command ?? ''}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
