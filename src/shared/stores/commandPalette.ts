import { create } from 'zustand';
export const useCommandPalette = create<{ isOpen: boolean; open: () => void; close: () => void; toggle: () => void }>((set) => ({ isOpen: false, open: () => set({ isOpen: true }), close: () => set({ isOpen: false }), toggle: () => set((s) => ({ isOpen: !s.isOpen })) }));
