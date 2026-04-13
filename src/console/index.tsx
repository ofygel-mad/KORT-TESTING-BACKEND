import { ConsoleView } from './Console';
import { useConsoleLifecycle } from './useConsoleLifecycle';

export function ConsoleRoot() {
  useConsoleLifecycle();
  return <ConsoleView />;
}
