import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircleMore, MessageSquareDashed, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../shared/stores/auth';
import { useChatStore } from '../../shared/stores/chat';
import { SearchInput } from '../../shared/ui/SearchInput';
import {
  useChatConversations,
  useChatMessages,
  useMarkRead,
  useSendMessage,
  useEditMessage,
  useDeleteMessage,
  useSendAttachment,
  useStartConversation,
} from './hooks';
import { requestNotificationPermission } from './useChatSocket';
import type { ChatConversation, ChatMessage } from './types';
import { Bubble } from './components/Bubble';
import { TypingIndicator } from './components/TypingIndicator';
import { MessageSkeleton } from './components/MessageSkeleton';
import { NewChatPanel } from './components/NewChatPanel';
import { ChatInput } from './components/ChatInput';
import { useScrollToMessage } from './hooks/useScrollToMessage';
import styles from './ChatModal.module.css';

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

// ── ConvItem ───────────────────────────────────────────────────────────────

function ConvItem({
  conv,
  active,
  currentUserId,
  isOnline,
  onClick,
}: {
  conv: ChatConversation;
  active: boolean;
  currentUserId: string;
  isOnline: boolean;
  onClick: () => void;
}) {
  const other = conv.participants.find((p) => p.id !== currentUserId) ?? conv.participants[0];
  const name = other?.full_name ?? 'Неизвестно';

  const lastPreview = (() => {
    const lm = conv.last_message;
    if (!lm) return null;
    if (lm.deleted_at) return 'Сообщение удалено';
    if (lm.type === 'IMAGE') return '📷 Изображение';
    if (lm.type === 'FILE') return `📎 ${lm.attachment?.file_name ?? 'Файл'}`;
    if (lm.type === 'ORDER_REF') return '📋 Заказ';
    const prefix = lm.sender_id === currentUserId ? 'Вы: ' : '';
    return prefix + lm.body;
  })();

  return (
    <button
      className={[styles.convItem, active ? styles.convItemActive : ''].join(' ')}
      onClick={onClick}
      aria-selected={active}
    >
      <div className={styles.convAvatarWrap}>
        <div className={styles.convAvatar}>{getInitials(name)}</div>
        {isOnline && <span className={styles.onlineDot} />}
      </div>
      <div className={styles.convInfo}>
        <div className={styles.convName}>{name}</div>
        {lastPreview && (
          <div className={styles.convPreview}>{lastPreview}</div>
        )}
      </div>
      {conv.unread_count > 0 && (
        <span className={styles.convBadge}>{conv.unread_count > 9 ? '9+' : conv.unread_count}</span>
      )}
    </button>
  );
}

// ── MessageThread ──────────────────────────────────────────────────────────

function MessageThread({
  conversationId,
  currentUserId,
  otherName,
  otherUserId,
}: {
  conversationId: string;
  currentUserId: string;
  otherName: string;
  otherUserId: string;
}) {
  const {
    data,
    isLoading,
    isFetchingPreviousPage,
    hasPreviousPage,
    fetchPreviousPage,
  } = useChatMessages(conversationId);

  const send = useSendMessage(conversationId);
  const edit = useEditMessage(conversationId);
  const del = useDeleteMessage(conversationId);
  const sendFile = useSendAttachment(conversationId);
  const markRead = useMarkRead();
  const { containerRef, scrollToMessage } = useScrollToMessage();

  const {
    typingState,
    presenceState,
    setReplyingTo,
    setEditingMessage,
    editingMessage,
  } = useChatStore();

  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const initialScrollDoneRef = useRef(false);
  const prevMessageCountRef = useRef(0);

  const messages = data?.pages.flat() ?? [];
  const typingUsers = Object.values(typingState[conversationId] ?? {});
  const typingNames = typingUsers.map((u) => u.name);
  const isOtherOnline = presenceState[otherUserId] === 'online';

  // Mark as read when conversation opens
  useEffect(() => {
    markRead.mutate(conversationId);
    initialScrollDoneRef.current = false;
    prevMessageCountRef.current = 0;
    return () => {
      // clear typing state on unmount
    };
  }, [conversationId]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!isLoading && !initialScrollDoneRef.current && messages.length > 0) {
      initialScrollDoneRef.current = true;
      prevMessageCountRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [isLoading, messages.length]);

  // Auto-scroll on new messages if user is near bottom
  useEffect(() => {
    if (!initialScrollDoneRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const newCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = newCount;
    if (newCount > prevCount && !isFetchingPreviousPage) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
      if (isNearBottom) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages.length]);

  // Preserve scroll position when older messages are prepended
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (isFetchingPreviousPage) {
      prevScrollHeightRef.current = container.scrollHeight;
    } else if (prevScrollHeightRef.current > 0) {
      container.scrollTop += container.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [isFetchingPreviousPage]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasPreviousPage && !isFetchingPreviousPage) {
          fetchPreviousPage();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage]);

  // Group messages by date
  const grouped: Array<{ date: string; msgs: ChatMessage[] }> = [];
  for (const msg of messages) {
    const dateKey = formatDate(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.date === dateKey) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: dateKey, msgs: [msg] });
    }
  }

  function handleSendText(body: string, replyToId?: string | null) {
    send.mutate({ body, replyToId });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
  }

  function handleSendFile(file: File) {
    sendFile.mutate(file, {
      onSuccess: () => {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
      },
    });
  }

  function handleConfirmEdit(body: string) {
    if (!editingMessage) return;
    edit.mutate({ messageId: editingMessage.id, body });
  }

  return (
    <div className={styles.thread}>
      {/* Thread header */}
      <div className={styles.threadHeader}>
        <div className={styles.threadAvatarWrap}>
          <div className={styles.threadAvatar}>{getInitials(otherName)}</div>
          {isOtherOnline && <span className={styles.onlineDotThread} />}
        </div>
        <div>
          <div className={styles.threadName}>{otherName}</div>
          {isOtherOnline && (
            <div className={styles.onlineLabel}>в сети</div>
          )}
        </div>
      </div>

      {/* Messages scroll area */}
      <div ref={containerRef} className={styles.messages}>
        <div ref={topSentinelRef} className={styles.loadOlderSentinel}>
          {isFetchingPreviousPage && (
            <span className={styles.loadingOlderText}>Загрузка...</span>
          )}
        </div>

        {isLoading && <MessageSkeleton />}

        {!isLoading && messages.length === 0 && (
          <div className={styles.threadEmpty}>
            <MessageSquareDashed size={32} className={styles.threadEmptyIcon} />
            <span className={styles.threadEmptyText}>Начните диалог с {otherName}</span>
          </div>
        )}

        {grouped.map((group) => (
          <div key={group.date}>
            <div className={styles.dateSep}>
              <span className={styles.dateSepLabel}>{group.date}</span>
            </div>
            {group.msgs.map((msg) => (
              <Bubble
                key={msg.id}
                msg={msg}
                isMine={msg.sender_id === currentUserId}
                isOptimistic={msg.id.startsWith('optimistic-')}
                onReply={() => setReplyingTo(msg)}
                onEdit={() => setEditingMessage(msg)}
                onDelete={() => {
                  if (window.confirm('Удалить сообщение?')) {
                    del.mutate(msg.id);
                  }
                }}
                onQuoteClick={(id) => scrollToMessage(id)}
              />
            ))}
          </div>
        ))}

        <TypingIndicator names={typingNames} />
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        conversationId={conversationId}
        currentUserId={currentUserId}
        currentUserName="Вы"
        otherParticipantName={otherName}
        onSendText={handleSendText}
        onSendFile={handleSendFile}
        onConfirmEdit={handleConfirmEdit}
        isSending={send.isPending || sendFile.isPending}
      />
    </div>
  );
}

// ── Main ChatModal ─────────────────────────────────────────────────────────

export function ChatModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const {
    activeConversationId,
    targetUserId,
    setActiveConversation,
    searchQuery,
    setSearchQuery,
    presenceState,
  } = useChatStore();
  const { data: conversations = [] } = useChatConversations();
  const startConv = useStartConversation();
  const backdropRef = useRef<HTMLDivElement>(null);
  const [showNewChat, setShowNewChat] = useState(false);

  // Request notification permission on first open
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Resolve targetUserId → existing conversation or stay in "new DM" mode
  useEffect(() => {
    if (!targetUserId || conversations.length === 0) return;
    const existing = conversations.find((c) =>
      c.participants.some((p) => p.id === targetUserId),
    );
    if (existing) {
      setActiveConversation(existing.id);
    }
  }, [targetUserId, conversations, setActiveConversation]);

  const activeConv = conversations.find((c) => c.id === activeConversationId) ?? null;
  const otherParticipant = activeConv?.participants.find((p) => p.id !== user?.id);

  const pendingTargetName = (() => {
    if (!targetUserId || activeConversationId) return null;
    const fromConv = conversations.flatMap((c) => c.participants).find((p) => p.id === targetUserId);
    return fromConv?.full_name ?? null;
  })();

  const filteredConversations = searchQuery
    ? conversations.filter((conv) => {
        const other = conv.participants.find((p) => p.id !== user?.id);
        return other?.full_name.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : conversations;

  function handleStartConversation() {
    if (!targetUserId) return;
    startConv.mutate(targetUserId, {
      onSuccess: (data) => setActiveConversation(data.id),
      onError: () => toast.error('Не удалось создать диалог'),
    });
  }

  return createPortal(
    <motion.div
      className={styles.backdrop}
      ref={backdropRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* ── Left panel ── */}
        <div className={styles.sidebar}>
          {showNewChat ? (
            <NewChatPanel onClose={() => setShowNewChat(false)} />
          ) : (
            <>
              <div className={styles.sidebarHeader}>
                <MessageCircleMore size={15} className={styles.sidebarIcon} />
                <span className={styles.sidebarTitle}>Сообщения</span>
                <button
                  className={styles.newChatBtn}
                  onClick={() => setShowNewChat(true)}
                  title="Новый диалог"
                  aria-label="Новый диалог"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className={styles.sidebarSearch}>
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Поиск..."
                />
              </div>

              <div className={styles.convList}>
                {filteredConversations.length === 0 && (
                  <div className={styles.convEmpty}>
                    <MessageSquareDashed size={28} className={styles.convEmptyIcon} />
                    <span className={styles.convEmptyText}>
                      {searchQuery ? 'Не найдено' : 'Нет диалогов'}
                    </span>
                    {!searchQuery && (
                      <span className={styles.convEmptyHint}>
                        Нажмите «+» или на аватар сотрудника в панели справа
                      </span>
                    )}
                  </div>
                )}
                {filteredConversations.map((conv) => {
                  const other = conv.participants.find((p) => p.id !== user?.id);
                  const isOnline = other ? presenceState[other.id] === 'online' : false;
                  return (
                    <ConvItem
                      key={conv.id}
                      conv={conv}
                      active={conv.id === activeConversationId}
                      currentUserId={user?.id ?? ''}
                      isOnline={isOnline}
                      onClick={() => setActiveConversation(conv.id)}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Right panel ── */}
        <div className={styles.main}>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <X size={16} />
          </button>

          {activeConversationId && otherParticipant && (
            <MessageThread
              conversationId={activeConversationId}
              currentUserId={user?.id ?? ''}
              otherName={otherParticipant.full_name}
              otherUserId={otherParticipant.id}
            />
          )}

          {!activeConversationId && pendingTargetName && (
            <div className={styles.newDmPane}>
              <div className={styles.newDmAvatar}>{getInitials(pendingTargetName)}</div>
              <div className={styles.newDmName}>{pendingTargetName}</div>
              <p className={styles.newDmHint}>У вас пока нет переписки с этим пользователем.</p>
              <button
                className={styles.newDmBtn}
                onClick={handleStartConversation}
                disabled={startConv.isPending}
              >
                {startConv.isPending ? 'Создаём...' : 'Начать диалог'}
              </button>
            </div>
          )}

          {!activeConversationId && !pendingTargetName && (
            <div className={styles.noConvPane}>
              <MessageCircleMore size={40} className={styles.noConvIcon} />
              <p className={styles.noConvText}>Выберите диалог или начните новый</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
