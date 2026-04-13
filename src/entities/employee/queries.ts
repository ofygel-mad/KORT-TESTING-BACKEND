import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { employeeApi } from './api';
import type { CreateEmployeeDto, UpdateEmployeeDto, Employee } from './types';

export const employeeKeys = {
  all: ['employees'] as const,
  list: ['employees', 'list'] as const,
};

export const useEmployees = () =>
  useQuery({ queryKey: employeeKeys.list, queryFn: () => employeeApi.list(), staleTime: 5 * 60_000 });

export const useCreateEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEmployeeDto) => employeeApi.create(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: employeeKeys.all }); toast.success('Сотрудник добавлен'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Не удалось добавить сотрудника'),
  });
};

export const useUpdateEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateEmployeeDto }) => employeeApi.update(id, dto),
    onSuccess: (updatedEmployee: Employee) => {
      // Immediately patch the cache so reopening the drawer shows fresh data
      qc.setQueryData(
        employeeKeys.list,
        (old: { count: number; results: Employee[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            results: old.results.map(e => e.id === updatedEmployee.id ? updatedEmployee : e),
          };
        },
      );
      qc.invalidateQueries({ queryKey: employeeKeys.all });
      toast.success('Сохранено');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Не удалось сохранить'),
  });
};

export const useDismissEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employeeApi.dismiss(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: employeeKeys.all }); toast.success('Сотрудник деактивирован'); },
    onError: () => toast.error('Не удалось деактивировать'),
  });
};

export const useResetPassword = () =>
  useMutation({
    mutationFn: (id: string) => employeeApi.resetPassword(id),
    onSuccess: (data) => toast.success(`Временный пароль: ${data.tempPassword}`),
    onError: () => toast.error('Не удалось сбросить пароль'),
  });

export const useRemoveEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employeeApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: employeeKeys.all }); toast.success('Сотрудник удалён'); },
    onError: () => toast.error('Не удалось удалить сотрудника'),
  });
};
