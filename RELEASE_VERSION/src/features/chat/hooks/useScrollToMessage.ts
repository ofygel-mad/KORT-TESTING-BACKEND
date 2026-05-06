import { useRef } from 'react';

export function useScrollToMessage() {
  const containerRef = useRef<HTMLDivElement>(null);

  function scrollToMessage(messageId: string) {
    const container = containerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('chatFlashHighlight');
    setTimeout(() => el.classList.remove('chatFlashHighlight'), 1500);
  }

  return { containerRef, scrollToMessage };
}
