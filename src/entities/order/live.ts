import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, apiClient } from '../../shared/api/client';
import { useAuthStore } from '../../shared/stores/auth';
import type {
  OrderWarehouseMetricsPatchEvent,
  OrderWarehouseLiveSnapshot,
  OrderWarehouseState,
  OrderWarehouseStatePatchEvent,
  OrderWarehouseStatesResponse,
} from './types';
import { orderKeys } from './queries';

export function useOrderWarehouseLiveSync(orderId?: string, enabled = true) {
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

  const syncWarehouseStateCaches = (warehouseState: OrderWarehouseState) => {
    queryClient.setQueryData(
      orderKeys.warehouseState(warehouseState.orderId),
      warehouseState,
    );

    queryClient.setQueriesData<OrderWarehouseStatesResponse>(
      {
        predicate: (query) =>
          Array.isArray(query.queryKey)
          && query.queryKey[0] === orderKeys.all[0]
          && query.queryKey[1] === 'warehouse-states',
      },
      (current) => {
        if (!current) {
          return current;
        }

        let touched = false;
        const results = current.results.map((state) => {
          if (state.orderId !== warehouseState.orderId) {
            return state;
          }

          touched = true;
          return warehouseState;
        });

        if (!touched) {
          return current;
        }

        return {
          count: results.length,
          results,
        };
      },
    );
  };

  const syncWarehouseMetricsCaches = (payload: OrderWarehouseMetricsPatchEvent) => {
    queryClient.setQueryData<OrderWarehouseState | undefined>(
      orderKeys.warehouseState(payload.orderId),
      (current) => (
        current
          ? {
              ...current,
              site: payload.site,
              reservationSummary: payload.reservationSummary,
              documentSummary: payload.documentSummary,
            }
          : current
      ),
    );

    queryClient.setQueriesData<OrderWarehouseStatesResponse>(
      {
        predicate: (query) =>
          Array.isArray(query.queryKey)
          && query.queryKey[0] === orderKeys.all[0]
          && query.queryKey[1] === 'warehouse-states',
      },
      (current) => {
        if (!current) {
          return current;
        }

        let touched = false;
        const results = current.results.map((state) => {
          if (state.orderId !== payload.orderId) {
            return state;
          }

          touched = true;
          return {
            ...state,
            site: payload.site,
            reservationSummary: payload.reservationSummary,
            documentSummary: payload.documentSummary,
          };
        });

        if (!touched) {
          return current;
        }

        return {
          count: results.length,
          results,
        };
      },
    );
  };

  useEffect(() => {
    connectRef.current = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = undefined;
      }

      const currentToken = useAuthStore.getState().token;
      const currentSelectedOrgId = useAuthStore.getState().selectedOrgId;
      const currentOrg = useAuthStore.getState().org;
      const resolvedOrgId = currentSelectedOrgId ?? currentOrg?.id ?? null;

      if (!enabled || !orderId || !currentToken || !resolvedOrgId) {
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        setIsConnected(false);
        return;
      }

      eventSourceRef.current?.close();

      const baseUrl = API_BASE_URL.replace(/\/+$/, '');
      const url = `${baseUrl}/warehouse-live/order-stream?token=${encodeURIComponent(currentToken)}&orgId=${encodeURIComponent(resolvedOrgId)}&orderId=${encodeURIComponent(orderId)}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('connected', () => {
        failCountRef.current = 0;
        setIsConnected(true);
      });

      eventSource.addEventListener('snapshot', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as OrderWarehouseLiveSnapshot;
          syncWarehouseStateCaches(payload.warehouseState);
          setLastSyncAt(payload.generatedAt);
          setIsConnected(true);
        } catch {
          // ignore malformed payloads
        }
      });

      eventSource.addEventListener('order_state_patch', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as OrderWarehouseStatePatchEvent;
          syncWarehouseStateCaches(payload.warehouseState);
          setLastSyncAt(payload.generatedAt);
          setIsConnected(true);
        } catch {
          // ignore malformed payloads
        }
      });

      eventSource.addEventListener('order_metrics_patch', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as OrderWarehouseMetricsPatchEvent;
          syncWarehouseMetricsCaches(payload);
          setLastSyncAt(payload.generatedAt);
          setIsConnected(true);
        } catch {
          // ignore malformed payloads
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
    };
  }, [enabled, orderId, queryClient]);

  useEffect(() => {
    connectRef.current();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [enabled, orderId, orgId, token]);

  return {
    isConnected,
    lastSyncAt,
  };
}
