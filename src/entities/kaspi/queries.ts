import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { readApiErrorMessage } from '../../shared/api/errors';
import { kaspiApi } from './api';
import type { ListKaspiOrdersParams, SaveKaspiConnectionDto } from './types';

export const kaspiKeys = {
  all: ['kaspi_integration'] as const,
  connection: () => [...kaspiKeys.all, 'connection'] as const,
  connections: () => [...kaspiKeys.all, 'connections'] as const,
  orders: (params?: object) => [...kaspiKeys.all, 'orders', params] as const,
  order: (externalOrderId: string) => [...kaspiKeys.all, 'order', externalOrderId] as const,
  summary: () => [...kaspiKeys.all, 'summary'] as const,
};

export const useKaspiConnection = () =>
  useQuery({
    queryKey: kaspiKeys.connection(),
    queryFn: () => kaspiApi.getConnection(),
  });

export const useKaspiConnections = () =>
  useQuery({
    queryKey: kaspiKeys.connections(),
    queryFn: () => kaspiApi.listConnections(),
  });

export const useKaspiOrders = (params?: ListKaspiOrdersParams) =>
  useQuery({
    queryKey: kaspiKeys.orders(params),
    queryFn: () => kaspiApi.listOrders(params),
  });

export const useKaspiOrder = (externalOrderId: string | undefined) =>
  useQuery({
    queryKey: externalOrderId ? kaspiKeys.order(externalOrderId) : [...kaspiKeys.all, 'order', 'empty'],
    queryFn: () => kaspiApi.getOrder(externalOrderId!),
    enabled: !!externalOrderId,
  });

export const useKaspiOrdersSummary = () =>
  useQuery({
    queryKey: kaspiKeys.summary(),
    queryFn: () => kaspiApi.getSummary(),
  });

export const useSaveKaspiConnection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SaveKaspiConnectionDto) => kaspiApi.saveConnection(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kaspiKeys.all });
      toast.success('Kaspi connection saved');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Failed to save Kaspi connection')),
  });
};

export const useDisconnectKaspiConnection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => kaspiApi.disconnectConnection(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kaspiKeys.all });
      toast.success('Kaspi connection archived');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Failed to disconnect Kaspi connection')),
  });
};

export const useTestKaspiConnection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => kaspiApi.testConnection(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kaspiKeys.connection() });
      toast.success('Kaspi connection verified');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Failed to verify Kaspi connection')),
  });
};

export const useSyncKaspiOrders = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => kaspiApi.syncOrders(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kaspiKeys.all });
      toast.success('Kaspi orders synced');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Failed to sync Kaspi orders')),
  });
};

export const useExportKaspiConnection = () =>
  useMutation({
    mutationFn: async (connectionId: string) => {
      const file = await kaspiApi.exportConnection(connectionId);
      const blob = new Blob([file.buffer], { type: file.contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName;
      link.click();
      URL.revokeObjectURL(url);
      return file;
    },
    onSuccess: () => {
      toast.success('Kaspi export downloaded');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Failed to export Kaspi orders')),
  });
