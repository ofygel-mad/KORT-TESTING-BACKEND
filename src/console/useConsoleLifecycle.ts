import { useEffect } from 'react';
import { appRouter } from '../app/router';
import { useAuthStore } from '../shared/stores/auth';
import { emitConsoleEvent, listenConsoleEvents } from './events';
import {
  activateConsoleAccess,
  canUseLocalConsoleAccess,
  hasPersistedConsoleSession,
} from './devAccess';
import { isConsoleAccessToken } from './devSession';
import { useConsoleStore } from './store';



type AuthSummary = {
  userId: string | null;
  email: string | null;
  unlocked: boolean;
  membershipStatus: string;
  role: string | null;
  companyName: string | null;
};

function getAuthSummary(): AuthSummary {
  const state = useAuthStore.getState();

  return {
    userId: state.user?.id ?? null,
    email: state.user?.email ?? null,
    unlocked: state.isUnlocked,
    membershipStatus: state.membership.status,
    role: state.membership.role ?? state.role ?? null,
    companyName: state.membership.companyName ?? null,
  };
}

function logAuthDiff(previous: AuthSummary, next: AuthSummary) {
  if (previous.userId !== next.userId) {
    emitConsoleEvent({
      source: 'auth',
      level: next.userId ? 'success' : 'warn',
      message: next.userId
        ? `Session user changed to ${next.email ?? next.userId}.`
        : 'Session cleared.',
    });
  }

  if (previous.unlocked !== next.unlocked) {
    emitConsoleEvent({
      source: 'auth',
      level: next.unlocked ? 'success' : 'warn',
      message: next.unlocked ? 'Workspace unlocked.' : 'Workspace locked.',
    });
  }

  if (
    previous.membershipStatus !== next.membershipStatus
    || previous.role !== next.role
    || previous.companyName !== next.companyName
  ) {
    emitConsoleEvent({
      source: 'auth',
      level: next.membershipStatus === 'active' ? 'success' : 'info',
      message: `Membership is ${next.membershipStatus}/${next.role ?? 'viewer'}.`,
      details: `company: ${next.companyName ?? 'none'}`,
    });
  }
}

function readErrorMessage(reason: unknown) {
  if (reason instanceof Error) {
    return `${reason.name}: ${reason.message}`;
  }

  if (typeof reason === 'string') {
    return reason;
  }

  try {
    return JSON.stringify(reason);
  } catch {
    return 'Unknown error';
  }
}

function readRouteLabel() {
  const location = appRouter.state.location;
  return `${location.pathname}${location.search}`;
}

function deferConsoleEvent(callback: () => void) {
  window.setTimeout(callback, 0);
}

export function useConsoleLifecycle() {
  useEffect(() => {
    const addEntry = useConsoleStore.getState().addEntry;
    const removeConsoleEvents = listenConsoleEvents((payload) => {
      addEntry(payload);
    });

    addEntry({
      source: 'system',
      level: 'info',
      message: 'initialization',
      // Исправлено: добавлены обратные кавычки (backticks) для многострочного текста
      details: false
        ? 'Режим: mock API. Пароли: бэкенд "kortdev1234" | локальный "1234"'
        : `KORT OS [Build 8341] - DEV MODE
Compiled with ofygel-mad architecture.
Warning: Unverified signature detected. Root access granted.`,
    });

    // Очищаем фейковые mock-токены если бэкенд реальный
    if (!false && isConsoleAccessToken(useAuthStore.getState().token)) {
      useAuthStore.getState().clearAuth();
      emitConsoleEvent({
        source: 'auth',
        level: 'warn',
        message: 'Очищена mock-сессия (включён реальный API).',
      });
    }

    // Восстанавливаем mock-сессию после перезагрузки (только в mock-режиме)
    if (
      false
      && canUseLocalConsoleAccess()
      && hasPersistedConsoleSession()
      && isConsoleAccessToken(useAuthStore.getState().token)
    ) {
      activateConsoleAccess();
      useConsoleStore.getState().setServiceSession({
        active: true,
        activatedAt: new Date().toISOString(),
      });
      emitConsoleEvent({
        source: 'auth',
        level: 'success',
        message: 'Сессия восстановлена после перезагрузки.',
      });
    }

    let lastRoute = readRouteLabel();
    addEntry({
      source: 'router',
      level: 'info',
      message: `Route ready: ${lastRoute}`,
    });

    const unsubscribeRouter = appRouter.subscribe((state) => {
      const nextRoute = `${state.location.pathname}${state.location.search}`;
      if (nextRoute === lastRoute) {
        return;
      }

      lastRoute = nextRoute;
      emitConsoleEvent({
        source: 'router',
        level: 'info',
        message: `Mapsd to ${nextRoute}`,
      });
    });

    let previousAuth = getAuthSummary();
    const unsubscribeAuth = useAuthStore.subscribe(() => {
      const nextAuth = getAuthSummary();
      logAuthDiff(previousAuth, nextAuth);
      previousAuth = nextAuth;
    });

    const onlineHandler = () => {
      emitConsoleEvent({
        source: 'system',
        level: 'success',
        message: 'Network connection restored.',
      });
    };

    const offlineHandler = () => {
      emitConsoleEvent({
        source: 'system',
        level: 'warn',
        message: 'Network connection lost.',
      });
    };

    const errorHandler = (event: ErrorEvent) => {
      deferConsoleEvent(() => {
        emitConsoleEvent({
          source: 'system',
          level: 'error',
          message: `Unhandled error: ${event.message || 'runtime failure'}`,
          details: event.filename
            ? `${event.filename}:${event.lineno}:${event.colno}`
            : undefined,
        });
      });
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      deferConsoleEvent(() => {
        emitConsoleEvent({
          source: 'system',
          level: 'error',
          message: 'Unhandled promise rejection.',
          details: readErrorMessage(event.reason),
        });
      });
    };

    const analyticsHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ event?: string; payload?: unknown }>).detail;
      let payloadLabel: string | undefined;

      if (detail?.payload !== undefined) {
        try {
          payloadLabel = JSON.stringify(detail.payload);
        } catch {
          payloadLabel = 'Unserializable payload';
        }
      }

      emitConsoleEvent({
        source: 'analytics',
        level: 'info',
        message: `Analytics event: ${detail?.event ?? 'unknown'}`,
        details: payloadLabel,
      });
    };

    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);
    window.addEventListener('kort:analytics', analyticsHandler as EventListener);

    return () => {
      removeConsoleEvents();
      unsubscribeRouter();
      unsubscribeAuth();
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
      window.removeEventListener('kort:analytics', analyticsHandler as EventListener);
    };
  }, []);
}
