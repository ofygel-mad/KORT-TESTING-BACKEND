import { api } from '@/shared/api/client';
import type { Role, CreateRoleDto, UpdateRoleDto } from '@/entities/employee/types';

export const rolesApi = {
  list: () => api.get<{ count: number; results: Role[] }>('/roles'),
  create: (dto: CreateRoleDto) => api.post<Role>('/roles', dto),
  update: (id: string, dto: UpdateRoleDto) => api.patch<Role>(`/roles/${id}`, dto),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/roles/${id}`),
};
