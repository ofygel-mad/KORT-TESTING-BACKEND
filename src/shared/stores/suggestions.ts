import type { ReactNode } from 'react';
import { create } from 'zustand';

export interface Suggestion {
  id: string;
  icon?: ReactNode;
  text: string;
  action: () => void;
  dismissLabel?: string;
}

interface SuggestionsStore {
  items: Suggestion[];
  push: (s: Suggestion) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useSuggestionsStore = create<SuggestionsStore>((set) => ({
  items: [],
  push: (s) => set((st) => ({ items: [...st.items, s] })),
  dismiss: (id) => set((st) => ({ items: st.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [] }),
}));
