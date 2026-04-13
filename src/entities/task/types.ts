// Backend: Task model + TaskSubtask + TaskActivity
// priority enum: 'low' | 'medium' | 'high' | 'critical' (NOT 'urgent')

export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string | null;
  assignedName: string | null;
  createdBy: string | null;
  dueDate: string | null;
  completedAt: string | null;
  dealId: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks?: TaskSubtask[];
  activities?: TaskActivity[];
}

export interface TaskSubtask {
  id: string;
  taskId: string;
  text: string;
  done: boolean;
  createdAt: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  type: string;
  content: string | null;
  authorName: string;
  createdAt: string;
}

export interface PaginatedTasks {
  count: number;
  page: number;
  limit: number;
  totalPages: number;
  results: Task[];
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assignedTo?: string;
  assignedName?: string;
  dueDate?: string;
  dealId?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  assignedTo?: string;
  assignedName?: string;
  dueDate?: string;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  mine?: boolean;
  due_today?: boolean;
  overdue?: boolean;
  page?: number;
  limit?: number;
}
