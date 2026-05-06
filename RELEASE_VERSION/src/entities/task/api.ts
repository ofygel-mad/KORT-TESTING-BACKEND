import { api } from '../../shared/api/client';
import type { Task, PaginatedTasks, CreateTaskDto, UpdateTaskDto, TaskFilters } from './types';

export const tasksApi = {
  list: (filters?: TaskFilters) => {
    const params: Record<string, string | number | boolean | undefined> = {
      page: filters?.page,
      limit: filters?.limit,
      status: filters?.status,
      priority: filters?.priority,
    };
    if (filters?.mine) params.mine = '1';
    if (filters?.due_today) params.due_today = '1';
    if (filters?.overdue) params.overdue = '1';
    return api.get<PaginatedTasks>('/tasks', params);
  },

  get: (id: string) =>
    api.get<Task>(`/tasks/${id}`),

  create: (dto: CreateTaskDto) =>
    api.post<Task>('/tasks', dto),

  update: (id: string, dto: UpdateTaskDto) =>
    api.patch<Task>(`/tasks/${id}`, dto),

  updateStatus: (id: string, status: string) =>
    api.patch<Task>(`/tasks/${id}/status`, { status }),

  delete: (id: string) =>
    api.delete<{ ok: boolean }>(`/tasks/${id}`),

  addSubtask: (id: string, text: string) =>
    api.post<void>(`/tasks/${id}/subtasks`, { text }),

  toggleSubtask: (id: string, subtaskId: string, done: boolean) =>
    api.patch<void>(`/tasks/${id}/subtasks/${subtaskId}`, { done }),

  addActivity: (id: string, content: string) =>
    api.post<void>(`/tasks/${id}/activities`, { type: 'comment', content }),
};
