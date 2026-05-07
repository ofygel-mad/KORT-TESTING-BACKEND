import { useEffect, useState, useCallback } from 'react';
import { getWindow, readStorage, writeStorage } from './browser';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

let cachedEvent: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(ev: BeforeInstallPromptEvent | null) => void>();

const DISMISS_KEY = 'kort_pwa_dismissed_at';
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

function notify(event: BeforeInstallPromptEvent | null): void {
  cachedEvent = event;
  listeners.forEach((fn) => { try { fn(event); } catch { /* listener errors are isolated */ } });
}

function bootstrap(): void {
  const win = getWindow();
  if (!win) return;
  if ((win as Window & { __kortPwaBootstrapped?: boolean }).__kortPwaBootstrapped) return;
  (win as Window & { __kortPwaBootstrapped?: boolean }).__kortPwaBootstrapped = true;

  win.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    notify(e as BeforeInstallPromptEvent);
  });
  win.addEventListener('appinstalled', () => notify(null));
}

function dismissedRecently(): boolean {
  const raw = readStorage(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_COOLDOWN_MS;
}

export function usePwaInstallPrompt(): {
  canInstall: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  dismiss: () => void;
} {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(cachedEvent);
  const [dismissed, setDismissed] = useState<boolean>(() => dismissedRecently());

  useEffect(() => {
    bootstrap();
    listeners.add(setEvent);
    return () => { listeners.delete(setEvent); };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!event) return 'unavailable' as const;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      notify(null);
      if (choice.outcome === 'dismissed') {
        writeStorage(DISMISS_KEY, String(Date.now()));
        setDismissed(true);
      }
      return choice.outcome;
    } catch {
      return 'unavailable' as const;
    }
  }, [event]);

  const dismiss = useCallback(() => {
    writeStorage(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }, []);

  return {
    canInstall: !!event && !dismissed,
    promptInstall,
    dismiss,
  };
}
