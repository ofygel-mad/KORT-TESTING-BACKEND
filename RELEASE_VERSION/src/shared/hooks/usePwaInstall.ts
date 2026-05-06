import { useEffect, useState } from 'react';
import { getWindow } from '../lib/browser';

export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState<any>(null);
  useEffect(() => {
    const win = getWindow();
    if (!win) return;
    const handler = (event: Event) => { event.preventDefault(); setPromptEvent(event); };
    win.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => win.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);
  return { canInstall: Boolean(promptEvent), async install() { if (!promptEvent) return false; await promptEvent.prompt(); setPromptEvent(null); return true; } };
}
