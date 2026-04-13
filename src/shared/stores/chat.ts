import { create } from 'zustand';

type ChatStore = {
  isOpen: boolean;
  /** null = conversation list view; string = specific conversation */
  activeConversationId: string | null;
  /** userId to find/start a DM with (set when opening from a profile bubble) */
  targetUserId: string | null;
  /** total unread across all conversations — updated by WS events later */
  totalUnread: number;
  /** true for a few seconds when a new message arrives (animates floating bar) */
  hasActivity: boolean;

  open: (opts?: { conversationId?: string; userId?: string }) => void;
  close: () => void;
  setActiveConversation: (id: string | null) => void;
  setTotalUnread: (n: number) => void;
  notifyActivity: () => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  activeConversationId: null,
  targetUserId: null,
  totalUnread: 0,
  hasActivity: false,

  open: (opts) => set({
    isOpen: true,
    activeConversationId: opts?.conversationId ?? null,
    targetUserId: opts?.userId ?? null,
  }),

  close: () => set({
    isOpen: false,
    activeConversationId: null,
    targetUserId: null,
  }),

  setActiveConversation: (id) => set({
    activeConversationId: id,
    targetUserId: null,
  }),

  setTotalUnread: (n) => set({ totalUnread: n }),

  notifyActivity: () => {
    set({ hasActivity: true });
    setTimeout(() => set({ hasActivity: false }), 3000);
  },
}));
