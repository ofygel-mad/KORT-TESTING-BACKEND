import { useEffect, useRef } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useAuthStore } from '../../shared/stores/auth';
import { useChatStore } from '../../shared/stores/chat';
import type { ChatMessage } from './types';

const WS_BASE =
  (import.meta.env.VITE_API_BASE_URL ?? '/api/v1')
    .replace(/^http/, 'ws')
    .replace(/\/api\/v1\/?$/, '');

const WS_PATH = '/api/v1/ws/chat';

/**
 * Stable ref for sending messages through the WebSocket.
 * Set in ws.onopen, cleared on cleanup.
 * Used by useTypingBroadcast hook.
 */
export const chatSocketSendRef: { current: ((data: object) => void) | null } = { current: null };

/** Request browser notification permission on first open */
export function requestNotificationPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function notifyDesktop(senderName: string, body: string, convId: string) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(`Сообщение от ${senderName}`, {
      body: body.slice(0, 100) || 'Прикреплён файл',
    });
    n.onclick = () => {
      window.focus();
      useChatStore.getState().open({ conversationId: convId });
    };
  } catch {}
}

/**
 * Global singleton hook — mount once inside AppShell.
 * Connects only when the user has an active company membership.
 * Reconnects with exponential backoff on disconnect.
 */
export function useChatSocket() {
  const qc = useQueryClient();
  const { notifyActivity, setTotalUnread, setTyping, setPresence } = useChatStore();
  const hasCompanyAccess = useAuthStore((s) => s.membership.status === 'active');
  const getToken = () => useAuthStore.getState().token;

  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1000);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    if (!hasCompanyAccess) return;

    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;

      const token = getToken();
      if (!token) return;

      const url = `${WS_BASE}${WS_PATH}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        backoffRef.current = 1000;
        chatSocketSendRef.current = (data: object) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
          }
        };
      };

      ws.onmessage = (e: MessageEvent) => {
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(e.data as string);
        } catch {
          return;
        }

        const store = useChatStore.getState();

        switch (event.type) {
          case 'connected':
            break;

          case 'message.new': {
            const convId = event.conversation_id as string;
            const msg = event.message as ChatMessage;

            qc.setQueryData<InfiniteData<ChatMessage[]>>(
              ['chat', 'messages', convId],
              (old) => {
                if (!old?.pages?.length) return old;
                // Avoid duplicate if we're the sender (already optimistic)
                const exists = old.pages.some((p) => p.some((m) => m.id === msg.id));
                if (exists) return old;
                const pages = old.pages.map((p, i) =>
                  i === old.pages.length - 1 ? [...p, msg] : p,
                );
                return { ...old, pages };
              },
            );
            qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
            notifyActivity();

            if (store.activeConversationId !== convId) {
              setTotalUnread(store.totalUnread + 1);
            }

            // Desktop notification when window is hidden or chat closed
            const senderName = (msg as unknown as Record<string, unknown>).sender_name as string ?? '';
            if (document.hidden || !store.isOpen) {
              notifyDesktop(senderName || 'Новое сообщение', msg.body || 'Файл', convId);
            }
            break;
          }

          case 'message.edited': {
            const convId = event.conversation_id as string;
            const updatedMsg = event.message as ChatMessage;
            qc.setQueryData<InfiniteData<ChatMessage[]>>(
              ['chat', 'messages', convId],
              (old) => {
                if (!old?.pages?.length) return old;
                const pages = old.pages.map((p) =>
                  p.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)),
                );
                return { ...old, pages };
              },
            );
            qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
            break;
          }

          case 'message.deleted': {
            const convId = event.conversation_id as string;
            const messageId = event.message_id as string;
            const deletedAt = event.deleted_at as string;
            qc.setQueryData<InfiniteData<ChatMessage[]>>(
              ['chat', 'messages', convId],
              (old) => {
                if (!old?.pages?.length) return old;
                const pages = old.pages.map((p) =>
                  p.map((m) =>
                    m.id === messageId
                      ? { ...m, deleted_at: deletedAt, body: '' }
                      : m,
                  ),
                );
                return { ...old, pages };
              },
            );
            qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
            break;
          }

          case 'message.read': {
            qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
            break;
          }

          case 'typing': {
            const convId = event.conversation_id as string;
            const userId = event.user_id as string;
            const name = event.user_name as string;
            const isTyping = event.is_typing as boolean;
            setTyping(convId, userId, name, isTyping);
            break;
          }

          case 'presence.update': {
            const userId = event.user_id as string;
            const status = event.status as 'online' | 'offline';
            setPresence(userId, status);
            break;
          }

          default:
            break;
        }
      };

      ws.onclose = () => {
        chatSocketSendRef.current = null;
        if (unmountedRef.current) return;
        reconnectTimer.current = setTimeout(() => {
          backoffRef.current = Math.min(backoffRef.current * 2, 30_000);
          connect();
        }, backoffRef.current);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      chatSocketSendRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [hasCompanyAccess]);
}
