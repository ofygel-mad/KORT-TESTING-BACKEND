import type { TaskPriority } from '../../../../tasks-spa/api/types';
import { TASK_TYPE_LABEL } from '../../../../tasks-spa/api/types';

export { TASK_TYPE_LABEL };

export type PriorityTone = 'muted' | 'info' | 'warning' | 'danger';

export const PRIORITY_META_MAP: Record<TaskPriority, { label: string; tone: PriorityTone }> = {
  low: { label: 'Низкий', tone: 'muted' },
  medium: { label: 'Средний', tone: 'info' },
  high: { label: 'Высокий', tone: 'warning' },
  critical: { label: 'Критический', tone: 'danger' },
};
