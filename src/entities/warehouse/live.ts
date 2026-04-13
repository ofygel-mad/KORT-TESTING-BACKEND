import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL, apiClient } from '../../shared/api/client';
import { useAuthStore } from '../../shared/stores/auth';
import type {
  WarehouseSiteAlertsPatchEvent,
  WarehouseSiteFeedPatchEvent,
  WarehouseSiteLiveSnapshot,
  WarehouseSiteOperationsPatchEvent,
} from './types';
import { warehouseKeys } from './queries';
import { useQueryClient } from '@tanstack/react-query';

type UseWarehouseFoundationLiveSyncOptions = {
  feedLimit?: number;
  enabled?: boolean;
};

export function useWarehouseFoundationLiveSync(
  siteId?: string,
  { feedLimit = 12, enabled = true }: UseWarehouseFoundationLiveSyncOptions = {},
) {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const selectedOrgId = useAuthStore((state) => state.selectedOrgId);
  const currentOrgId = useAuthStore((state) => state.org?.id ?? null);
  const orgId = selectedOrgId ?? currentOrgId;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const failCountRef = useRef(0);
  const connectRef = useRef<() => void>(() => {});

  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = undefined;
    }

    const currentToken = useAuthStore.getState().token;
    const currentSelectedOrgId = useAuthStore.getState().selectedOrgId;
    const currentOrg = useAuthStore.getState().org;
    const currentOrgIdValue = currentSelectedOrgId ?? currentOrg?.id ?? null;

    if (!enabled || !siteId || !currentToken || !currentOrgIdValue) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const url = `${baseUrl}/warehouse-live/site-stream?token=${encodeURIComponent(currentToken)}&orgId=${encodeURIComponent(currentOrgIdValue)}&siteId=${encodeURIComponent(siteId)}&limit=${encodeURIComponent(String(feedLimit))}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', () => {
      failCountRef.current = 0;
      setIsConnected(true);
    });

    eventSource.addEventListener('snapshot', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as WarehouseSiteLiveSnapshot;

        queryClient.setQueryData(
          warehouseKeys.foundation.controlTower(siteId),
          payload.controlTower,
        );
        queryClient.setQueryData(
          warehouseKeys.foundation.feed(siteId, { limit: feedLimit }),
          payload.siteFeed,
        );
        queryClient.setQueryData(
          warehouseKeys.foundation.siteHealth(siteId),
          payload.siteHealth,
        );
        queryClient.invalidateQueries({ queryKey: warehouseKeys.foundation.twin(siteId) });
        queryClient.invalidateQueries({ queryKey: warehouseKeys.foundation.tasks(siteId) });
        queryClient.invalidateQueries({ queryKey: warehouseKeys.foundation.exceptions(siteId) });

        setLastSyncAt(payload.generatedAt);
        setIsConnected(true);
      } catch {
        // Ignore malformed payloads and wait for the next snapshot.
      }
    });

    eventSource.addEventListener('feed_patch', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as WarehouseSiteFeedPatchEvent;
        queryClient.setQueryData(
          warehouseKeys.foundation.feed(siteId, { limit: feedLimit }),
          payload.siteFeed,
        );
        setLastSyncAt(payload.generatedAt);
        setIsConnected(true);
      } catch {
        // Ignore malformed payloads and wait for the next patch or snapshot.
      }
    });

    eventSource.addEventListener('alerts_patch', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as WarehouseSiteAlertsPatchEvent;
        queryClient.setQueryData(
          warehouseKeys.foundation.controlTower(siteId),
          payload.controlTower,
        );
        queryClient.setQueryData(
          warehouseKeys.foundation.siteHealth(siteId),
          payload.siteHealth,
        );
        queryClient.invalidateQueries({ queryKey: warehouseKeys.foundation.twin(siteId) });
        queryClient.invalidateQueries({ queryKey: warehouseKeys.foundation.tasks(siteId) });
        queryClient.invalidateQueries({ queryKey: warehouseKeys.foundation.exceptions(siteId) });
        setLastSyncAt(payload.generatedAt);
        setIsConnected(true);
      } catch {
        // Ignore malformed payloads and wait for the next patch or snapshot.
      }
    });

    eventSource.addEventListener('operations_patch', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as WarehouseSiteOperationsPatchEvent;
        queryClient.setQueryData(
          warehouseKeys.foundation.controlTower(siteId),
          payload.controlTower,
        );
        queryClient.invalidateQueries({ queryKey: warehouseKeys.foundation.twin(siteId) });
        queryClient.invalidateQueries({ queryKey: warehouseKeys.foundation.tasks(siteId) });
        queryClient.invalidateQueries({ queryKey: warehouseKeys.foundation.exceptions(siteId) });
        setLastSyncAt(payload.generatedAt);
        setIsConnected(true);
      } catch {
        // Ignore malformed payloads and wait for the next patch or snapshot.
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      failCountRef.current += 1;

      if (failCountRef.current >= 2) {
        failCountRef.current = 0;
        apiClient.get('/chapan/orders?limit=1').catch(() => {
          // auth refresh is handled by axios interceptors
        });
      }

      const delay = Math.min(5_000 * Math.pow(1.5, Math.min(failCountRef.current, 4)), 30_000);
      reconnectTimerRef.current = setTimeout(() => connectRef.current(), delay);
    };
  }, [enabled, feedLimit, queryClient, siteId]);

  connectRef.current = connect;

  useEffect(() => {
    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connect, orgId, siteId, token]);

  return {
    isConnected,
    lastSyncAt,
  };
}
