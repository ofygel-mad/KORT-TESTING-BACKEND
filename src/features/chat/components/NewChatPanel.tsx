import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, User } from 'lucide-react';
import { api } from '../../../shared/api/client';
import { useAuthStore } from '../../../shared/stores/auth';
import { useChatStore } from '../../../shared/stores/chat';
import { useChatConversations, useStartConversation } from '../hooks';
import { SearchInput } from '../../../shared/ui/SearchInput';
import styles from './NewChatPanel.module.css';

interface TeamMember {
  id: string;
  full_name: string;
  phone?: string | null;
  employee_account_status?: string;
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

interface Props {
  onClose: () => void;
}

export function NewChatPanel({ onClose }: Props) {
  const [search, setSearch] = useState('');
  const user = useAuthStore((s) => s.user);
  const { setActiveConversation } = useChatStore();
  const { data: conversations = [] } = useChatConversations();
  const startConv = useStartConversation();

  const { data: teamRaw, isLoading } = useQuery<{ results: TeamMember[] }>({
    queryKey: ['team'],
    queryFn: () => api.get('/users/team'),
    staleTime: 60_000,
    retry: false,
    throwOnError: false,
  });

  const members = (teamRaw?.results ?? [])
    .filter((m) => m.id !== user?.id && m.employee_account_status !== 'dismissed')
    .filter((m) =>
      search ? m.full_name.toLowerCase().includes(search.toLowerCase()) : true,
    );

  function handleSelect(memberId: string) {
    const existing = conversations.find((c) =>
      c.participants.length === 2 && c.participants.some((p) => p.id === memberId),
    );
    if (existing) {
      setActiveConversation(existing.id);
      onClose();
      return;
    }

    startConv.mutate(memberId, {
      onSuccess: (data) => {
        setActiveConversation(data.id);
        onClose();
      },
    });
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.title}>Новый диалог</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
          <X size={14} />
        </button>
      </div>
      <div className={styles.search}>
        <SearchInput value={search} onChange={setSearch} placeholder="Поиск сотрудника..." />
      </div>
      <div className={styles.list}>
        {isLoading && (
          <div className={styles.empty}>Загрузка...</div>
        )}
        {!isLoading && members.length === 0 && (
          <div className={styles.empty}>Сотрудники не найдены</div>
        )}
        {members.map((m) => (
          <button
            key={m.id}
            className={styles.memberBtn}
            onClick={() => handleSelect(m.id)}
            disabled={startConv.isPending}
          >
            <div className={styles.avatar}>{getInitials(m.full_name)}</div>
            <span className={styles.name}>{m.full_name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
