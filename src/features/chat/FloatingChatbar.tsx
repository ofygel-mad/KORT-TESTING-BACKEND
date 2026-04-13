import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircleMore } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../../shared/api/client';
import { useAuthStore } from '../../shared/stores/auth';
import { useChatStore } from '../../shared/stores/chat';
import { useChatConversations } from './hooks';
import { ChatModal } from './ChatModal';
import styles from './FloatingChatbar.module.css';

interface TeamMember {
  id: string;
  full_name: string;
  phone?: string | null;
  employee_account_status?: string;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function FloatingChatbar() {
  const user = useAuthStore((s) => s.user);
  const hasCompanyAccess = useAuthStore((s) => s.membership.status === 'active');
  const { isOpen, totalUnread, hasActivity, open, close } = useChatStore();
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: teamRaw } = useQuery<{ results: TeamMember[] }>({
    queryKey: ['team'],
    queryFn: () => api.get('/users/team'),
    enabled: hasCompanyAccess,
    staleTime: 60_000,
    retry: false,
    throwOnError: false,
  });

  const { data: conversations = [] } = useChatConversations();

  const teamMembers = (teamRaw?.results ?? [])
    .filter((m) => m.id !== user?.id && m.employee_account_status !== 'dismissed')
    .slice(0, 5);

  // Unread count per userId (from conversations)
  const unreadByUserId: Record<string, number> = {};
  for (const conv of conversations) {
    const other = conv.participants.find((p) => p.id !== user?.id);
    if (other && conv.unread_count > 0) {
      unreadByUserId[other.id] = (unreadByUserId[other.id] ?? 0) + conv.unread_count;
    }
  }

  if (!hasCompanyAccess) return null;

  function handleEnter() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered(true);
  }
  function handleLeave() {
    leaveTimer.current = setTimeout(() => setHovered(false), 300);
  }

  const isLit = hovered || isOpen || hasActivity || totalUnread > 0;

  return (
    <>
      <div
        className={[styles.bar, isLit ? styles.barLit : '', hasActivity ? styles.barActivity : ''].join(' ')}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        aria-label="Чат"
      >
        {/* ── Profile bubbles (scrollable) ── */}
        <div className={styles.profileList}>
          {teamMembers.length === 0 && (
            <div className={styles.emptyHint} title="Добавьте сотрудников в Команде" />
          )}
          {teamMembers.map((member) => {
            const memberUnread = unreadByUserId[member.id] ?? 0;
            return (
              <button
                key={member.id}
                className={styles.profileBtn}
                onClick={() => open({ userId: member.id })}
                title={member.full_name}
                aria-label={`Написать ${member.full_name}`}
              >
                <span className={styles.profileAvatar}>{getInitials(member.full_name)}</span>
                {memberUnread > 0 && (
                  <span className={styles.unreadDot} aria-label={`${memberUnread} непрочитанных`} />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Divider ── */}
        {teamMembers.length > 0 && <div className={styles.divider} />}

        {/* ── Chat icon button ── */}
        <button
          className={[styles.chatIconBtn, isOpen ? styles.chatIconBtnActive : ''].join(' ')}
          onClick={() => (isOpen ? close() : open())}
          title="Открыть чат"
          aria-label="Открыть чат"
        >
          <MessageCircleMore size={18} strokeWidth={1.75} />
          <AnimatePresence>
            {totalUnread > 0 && (
              <motion.span
                className={styles.totalBadge}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                {totalUnread > 9 ? '9+' : totalUnread}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && <ChatModal onClose={close} />}
      </AnimatePresence>
    </>
  );
}
