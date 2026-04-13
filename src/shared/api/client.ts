import axios, { AxiosError } from 'axios';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import { emitConsoleEvent } from '../../console/events';
import { DEV_AUTH_BYPASS_ENABLED } from '../config/devAccess';
import { redirectTo } from '../lib/browser';
import { useAuthStore } from '../stores/auth';
import { readApiErrorMessage } from './errors';

function resolveApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL ?? '').trim();

  if (!configured) {
    return '/api/v1';
  }

  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return configured;
  }

  try {
    const isAbsoluteUrl = /^[a-z]+:\/\//i.test(configured);
    if (!isAbsoluteUrl) {
      return configured;
    }

    const parsed = new URL(configured);
    const isLocalBackend = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

    if (!isLocalBackend) {
      return configured;
    }

    // In local development prefer the Vite proxy to avoid fragile CORS/origin mismatches.
    return parsed.pathname.replace(/\/+$/, '') || '/api/v1';
  } catch {
    return configured;
  }
}

export const API_BASE_URL = resolveApiBaseUrl();

// Mock API disabled — all data from real backend

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

type RequestMeta = {
  startedAt: number;
  method: string;
  url: string;
};

function summarizePayload(payload: unknown) {
  if (!payload) {
    return undefined;
  }

  if (Array.isArray(payload)) {
    return `payload: array(${payload.length})`;
  }

  if (typeof payload === 'object') {
    const keys = Object.keys(payload as Record<string, unknown>).slice(0, 6);
    return keys.length > 0 ? `payload keys: ${keys.join(', ')}` : undefined;
  }

  return undefined;
}

function getDuration(startedAt?: number) {
  if (!startedAt) {
    return 0;
  }

  return Date.now() - startedAt;
}

function isSessionEstablishingRequest(url?: string) {
  const normalized = url ?? '';

  return normalized.includes('/auth/login')
    || normalized.includes('/auth/register/')
    || normalized.includes('/auth/token/refresh')
    || normalized.includes('/auth/set-password')
    || (normalized.includes('/invites/') && normalized.includes('/accept'));
}

function shouldClearAuthAfterRefreshFailure(error: unknown) {
  if (!(error instanceof AxiosError)) {
    return false;
  }

  const status = error.response?.status ?? 0;
  return status === 400 || status === 401 || status === 403;
}

function shouldSuppressPermissionToast(status: number) {
  if (status !== 403) {
    return false;
  }

  const state = useAuthStore.getState();
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

  return !state.token
    || state.membership.status !== 'active'
    || pathname.startsWith('/auth/');
}



apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const selectedOrgId = useAuthStore.getState().selectedOrgId;
  if (selectedOrgId) {
    config.headers['X-Org-Id'] = selectedOrgId;
  }

  config.headers['X-Request-ID'] = nanoid();
  if (['post', 'put', 'patch', 'delete'].includes((config.method ?? '').toLowerCase())) {
    config.headers['Idempotency-Key'] = config.headers['Idempotency-Key'] ?? nanoid();
  }

  const nextConfig = config as typeof config & { metadata?: RequestMeta };
  nextConfig.metadata = {
    startedAt: Date.now(),
    method: (config.method ?? 'get').toUpperCase(),
    url: config.url ?? '/',
  };

  emitConsoleEvent({
    source: 'api',
    level: 'info',
    message: `REQ ${nextConfig.metadata.method} ${nextConfig.metadata.url}`,
    details: summarizePayload(config.data),
  });

  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: string) => void; reject: (error: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((item) => (error ? item.reject(error) : item.resolve(token!)));
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => {
    const config = response.config as typeof response.config & { metadata?: RequestMeta };
    const duration = getDuration(config.metadata?.startedAt);

    emitConsoleEvent({
      source: 'api',
      level: 'success',
      message: `RES ${response.status} ${config.metadata?.method ?? 'GET'} ${config.metadata?.url ?? response.config.url ?? '/'}`,
      details: `${duration}ms`,
    });

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };
    const requestUrl = originalRequest?.url ?? '';

    if (
      error.response?.status === 401
      && !originalRequest?._retry
      && !isSessionEstablishingRequest(requestUrl)
    ) {
      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        if (!DEV_AUTH_BYPASS_ENABLED) {
          useAuthStore.getState().clearAuth();
          redirectTo('/');
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest!.headers!.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest!);
        });
      }

      originalRequest!._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });
        const newAccess: string = response.data.access;
        const newRefresh: string = response.data.refresh ?? refreshToken;

        useAuthStore.getState().setTokens(newAccess, newRefresh);
        processQueue(null, newAccess);

        originalRequest!.headers!.Authorization = `Bearer ${newAccess}`;
        return apiClient(originalRequest!);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (!DEV_AUTH_BYPASS_ENABLED && shouldClearAuthAfterRefreshFailure(refreshError)) {
          useAuthStore.getState().clearAuth();
          redirectTo('/');
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (
      error.response?.status === 401
      && !isSessionEstablishingRequest(requestUrl)
      && (useAuthStore.getState().token || useAuthStore.getState().refreshToken)
    ) {
      if (!DEV_AUTH_BYPASS_ENABLED) {
        useAuthStore.getState().clearAuth();
        redirectTo('/');
      }
    }

    if (error.response?.status === 403 && !shouldSuppressPermissionToast(403)) {
      const message = readApiErrorMessage(error, 'You do not have access to this action.');
      toast.error(message);
    }

    if ((error.response?.status ?? 0) >= 500) {
      toast.error('Ошибка сервера. Попробуйте позже.');
    }

    const config = error.config as typeof error.config & { metadata?: RequestMeta };
    const duration = getDuration(config?.metadata?.startedAt);

    emitConsoleEvent({
      source: 'api',
      level: 'error',
      message: `ERR ${error.response?.status ?? 'NET'} ${config?.metadata?.method ?? 'GET'} ${config?.metadata?.url ?? error.config?.url ?? '/'}`,
      details: `${duration}ms${error.message ? `\n${error.message}` : ''}`,
    });

    return Promise.reject(error);
  },
);

export const api = {
  get:    <T>(url: string, params?: object) =>
    apiClient.get<T>(url, { params }).then((r) => r.data),
  post:   <T>(url: string, data?: object, headers?: Record<string, string>) =>
    apiClient.post<T>(url, data, headers ? { headers } : undefined).then((r) => r.data),
  patch:  <T>(url: string, data?: object, headers?: Record<string, string>) =>
    apiClient.patch<T>(url, data, headers ? { headers } : undefined).then((r) => r.data),
  put:    <T>(url: string, data?: object, headers?: Record<string, string>) =>
    apiClient.put<T>(url, data, headers ? { headers } : undefined).then((r) => r.data),
  delete: <T>(url: string) =>
    apiClient.delete<T>(url).then((r) => r.data),
};
