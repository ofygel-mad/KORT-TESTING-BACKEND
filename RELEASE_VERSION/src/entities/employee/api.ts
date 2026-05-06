import { api } from '../../shared/api/client';
import type { Employee, CreateEmployeeDto, UpdateEmployeeDto } from './types';

export const employeeApi = {
  // IMPORTANT: prefix is /company, not /employees
  list: () =>
    api.get<{ count: number; results: Employee[] }>('/company/employees'),

  create: (dto: CreateEmployeeDto) =>
    api.post<Employee>('/company/employees', dto),

  update: (id: string, dto: UpdateEmployeeDto) =>
    api.patch<Employee>(`/company/employees/${id}`, dto),

  dismiss: (id: string) =>
    api.post<{ ok: boolean }>(`/company/employees/${id}/dismiss`, {}),

  resetPassword: (id: string) =>
    api.post<{ tempPassword: string }>(`/company/employees/${id}/reset-password`, {}),

  remove: (id: string) =>
    api.delete<{ ok: boolean }>(`/company/employees/${id}`),
};
