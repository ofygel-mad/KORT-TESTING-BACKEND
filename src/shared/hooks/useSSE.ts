import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/auth';
import { API_BASE_URL, apiClient } from '../api/client';

type SSEOptions = {
  onNotification?: (data: Record<string, any>) => void;
  onConnected?: () => void;
  enabled?: boolean;
};

export function useSSE({ onNotification, onConnected, enabled = true }: SSEOptions = {}) {
  const token = useAuthStore(s => s.token);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const failCountRef = useRef(0);

  // Always-fresh ref — avoids stale closure in onerror/setTimeout
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    const currentToken = useAuthStore.getState().token;
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = undefined;
    }

    if (!currentToken || !enabled) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    if (esRef.current) esRef.current.close();

    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const url = `${baseUrl}/sse/?token=${encodeURIComponent(currentToken)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('connected', () => {
      failCountRef.current = 0;
      onConnected?.();
    });
    es.addEventListener('notification', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        onNotification?.(data);
      } catch {
        // ignore malformed events
      }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      failCountRef.current += 1;

      // After 2 consecutive failures try to refresh the access token via axios
      // (which goes through the refresh interceptor). If auth is truly gone,
      // the interceptor will clear auth and stop retries.
      if (failCountRef.current >= 2) {
        failCountRef.current = 0;
        apiClient.get('/chapan/orders?limit=1').catch(() => {
          // If axios refresh also failed, useAuthStore will be cleared by the
          // axios interceptor and `token` will become null — the effect will
          // re-run and skip connecting (guard at top of connect).
        });
      }

      // Always use the ref so we get the latest connect (with refreshed token)
      const delay = Math.min(5000 * Math.pow(1.5, Math.min(failCountRef.current, 4)), 30000);
      reconnectTimer.current = setTimeout(() => connectRef.current(), delay);
    };
  }, [enabled, onNotification, onConnected]);

  // Keep ref in sync with latest connect so onerror closures are never stale
  connectRef.current = connect;

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect, token]);
}
