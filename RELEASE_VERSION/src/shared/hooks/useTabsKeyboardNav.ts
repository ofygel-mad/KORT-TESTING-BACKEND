import type { KeyboardEvent } from 'react';

export function useTabsKeyboardNav<T extends string>(
  tabs: readonly T[],
  activeTab: T,
  onChange: (next: T) => void,
) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (!tabs.length) return;
    const currentIndex = Math.max(tabs.indexOf(activeTab), 0);

    const move = (nextIndex: number) => {
      const normalized = (nextIndex + tabs.length) % tabs.length;
      onChange(tabs[normalized]);
    };

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        move(currentIndex + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        move(currentIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        move(0);
        break;
      case 'End':
        event.preventDefault();
        move(tabs.length - 1);
        break;
      default:
        break;
    }
  };
}
