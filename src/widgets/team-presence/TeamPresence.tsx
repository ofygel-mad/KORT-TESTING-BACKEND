import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import s from './TeamPresence.module.css';

export function TeamPresence() {
  const { data } = useQuery({ queryKey: ['team-presence'], queryFn: () => api.get<any[]>('/team/presence'), refetchInterval: 30000 });
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) return null;
  return (
    <div className={s.root}>
      {rows.map((row: any) => (
        <div key={row.id} className={s.row}>
          <span className={s.name}>{row.full_name}</span>
          <span className={s.state}>{row.presence_state}</span>
        </div>
      ))}
    </div>
  );
}
