import type { ConsoleEventPayload } from './types';

const CONSOLE_EVENT_NAME = 'kort:console:event';

function getEventTarget() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window;
}

export function emitConsoleEvent(payload: ConsoleEventPayload) {
  const target = getEventTarget();
  if (!target) {
    return;
  }

  target.dispatchEvent(
    new CustomEvent(CONSOLE_EVENT_NAME, {
      detail: payload,
    }),
  );
}

export function listenConsoleEvents(listener: (payload: ConsoleEventPayload) => void) {
  const target = getEventTarget();
  if (!target) {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ConsoleEventPayload>).detail;
    if (detail) {
      listener(detail);
    }
  };

  target.addEventListener(CONSOLE_EVENT_NAME, handler);
  return () => target.removeEventListener(CONSOLE_EVENT_NAME, handler);
}
