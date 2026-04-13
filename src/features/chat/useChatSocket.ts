import { useEffect, useRef } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useAuthStore } from '../../shared/stores/auth';
import { useChatStore } from '../../shared/stores/chat';
import type { ChatMessage } from './types';

const WS_BASE =
  (import.meta.env.VITE_API_BASE_URL ?? '/api/v1')
    .replace(/^http/, 'ws')         // http→ws, https→wss
    .replace(/\/api\/v1\/?$/, '');  // strip /api/v1 suffix — we append it ourselves

const WS_PATH = '/api/v1/ws/chat';

/**
 * Global singleton hook — mount once inside AppShell.
 * Connects only when the user has an active company membership.
 * Reconnects with exponential backoff on disconnect.
 */
export function useChatSocket() {
  const qc = useQueryClient();
  const { notifyActivity, setTotalUnread, activeConversationId } = useChatStore();
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
        backoffRef.current = 1000; // reset backoff on successful connection
      };

      ws.onmessage = (e: MessageEvent) => {
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(e.data as string);
        } catch {
          return;
        }

        switch (event.type) {
          case 'connected':
            // Initial ack — nothing to do
            break;

          case 'message.new': {
            const convId = event.conversation_id as string;
            const msg = event.message as ChatMessage;
            // Append new message directly into the infinite query cache (preserves scroll history)
            qc.setQueryData<InfiniteData<ChatMessage[]>>(
              ['chat', 'messages', convId],
              (old) => {
                if (!old?.pages?.length) return old;
                const pages = old.pages.map((p, i) =>
                  i === old.pages.length - 1 ? [...p, msg] : p,
                );
                return { ...old, pages };
              },
            );
            // Refresh conversation list for unread counts and last_message preview
            qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
            // Animate the floating bar
            notifyActivity();
            // Increment total unread in store if not currently in that conversation
            if (activeConversationId !== convId) {
              setTotalUnread(useChatStore.getState().totalUnread + 1);
            }
            break;
          }

          case 'message.read': {
            qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
            break;
          }

          // presence.update — no-op until Phase 6
          default:
            break;
        }
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        // Exponential backoff reconnect: 1s → 2s → 4s → ... → 30s max
        reconnectTimer.current = setTimeout(() => {
          backoffRef.current = Math.min(backoffRef.current * 2, 30_000);
          connect();
        }, backoffRef.current);
      };

      ws.onerror = () => {
        ws.close(); // triggers onclose → reconnect
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [hasCompanyAccess]);
}
