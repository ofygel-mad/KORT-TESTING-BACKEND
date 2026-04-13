import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircleMore, Send, X, Plus, MessageSquareDashed } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../shared/stores/auth';
import { useChatStore } from '../../shared/stores/chat';
import {
  useChatConversations,
  useChatMessages,
  useMarkRead,
  useSendMessage,
  useStartConversation,
} from './hooks';
import type { ChatConversation, ChatMessage } from './types';
import styles from './ChatModal.module.css';

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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

// ── Conversation list item ──────────────────────────────────────────────────

function ConvItem({
  conv,
  active,
  currentUserId,
  onClick,
}: {
  conv: ChatConversation;
  active: boolean;
  currentUserId: string;
  onClick: () => void;
}) {
  const other = conv.participants.find((p) => p.id !== currentUserId) ?? conv.participants[0];
  const name = other?.full_name ?? 'Неизвестно';

  return (
    <button
      className={[styles.convItem, active ? styles.convItemActive : ''].join(' ')}
      onClick={onClick}
      aria-selected={active}
    >
      <div className={styles.convAvatar}>{getInitials(name)}</div>
      <div className={styles.convInfo}>
        <div className={styles.convName}>{name}</div>
        {conv.last_message && (
          <div className={styles.convPreview}>
            {conv.last_message.sender_id === currentUserId ? 'Вы: ' : ''}
            {conv.last_message.body}
          </div>
        )}
      </div>
      {conv.unread_count > 0 && (
        <span className={styles.convBadge}>{conv.unread_count > 9 ? '9+' : conv.unread_count}</span>
      )}
    </button>
  );
}

// ── Message bubble ──────────────────────────────────────────────────────────

function Bubble({ msg, isMine, isOptimistic }: { msg: ChatMessage; isMine: boolean; isOptimistic?: boolean }) {
  return (
    <div className={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowTheirs].join(' ')}>
      <div className={[
        styles.bubble,
        isMine ? styles.bubbleMine : styles.bubbleTheirs,
        isOptimistic ? styles.bubbleOptimistic : '',
      ].join(' ')}>
        <span className={styles.bubbleText}>{msg.body}</span>
        <span className={styles.bubbleTime}>{formatTime(msg.created_at)}</span>
      </div>
    </div>
  );
}

// ── Message thread ─────────────────────────────────────────────────────────

function MessageThread({
  conversationId,
  currentUserId,
  otherName,
}: {
  conversationId: string;
  currentUserId: string;
  otherName: string;
}) {
  const {
    data,
    isLoading,
    isFetchingPreviousPage,
    hasPreviousPage,
    fetchPreviousPage,
  } = useChatMessages(conversationId);
  const send = useSendMessage(conversationId);
  const markRead = useMarkRead();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevScrollHeightRef = useRef(0);
  const initialScrollDoneRef = useRef(false);
  const prevMessageCountRef = useRef(0);

  // Flatten pages into chronological message list
  const messages = data?.pages.flat() ?? [];

  // Mark as read when conversation opens
  useEffect(() => {
    markRead.mutate(conversationId);
    initialScrollDoneRef.current = false;
    prevMessageCountRef.current = 0;
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
    const container = messagesRef.current;
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
    const container = messagesRef.current;
    if (!container) return;
    if (isFetchingPreviousPage) {
      prevScrollHeightRef.current = container.scrollHeight;
    } else if (prevScrollHeightRef.current > 0) {
      container.scrollTop += container.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [isFetchingPreviousPage]);

  // IntersectionObserver on top sentinel to load older messages
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

  function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    send.mutate(body);
    inputRef.current?.focus();
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className={styles.thread}>
      {/* Thread header */}
      <div className={styles.threadHeader}>
        <div className={styles.threadAvatar}>{getInitials(otherName)}</div>
        <div className={styles.threadName}>{otherName}</div>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className={styles.messages}>
        {/* Top sentinel — watched by IntersectionObserver to load older messages */}
        <div ref={topSentinelRef} className={styles.loadOlderSentinel}>
          {isFetchingPreviousPage && (
            <span className={styles.loadingOlderText}>Загрузка...</span>
          )}
        </div>

        {isLoading && (
          <div className={styles.threadEmpty}>
            <span className={styles.threadEmptyText}>Загрузка...</span>
          </div>
        )}

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
              />
            ))}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={styles.inputRow}>
        <button className={styles.attachBtn} title="Прикрепить" aria-label="Прикрепить файл">
          <Plus size={16} />
        </button>
        <textarea
          ref={inputRef}
          className={styles.messageInput}
          placeholder="Напишите сообщение..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={2000}
        />
        <button
          className={[styles.sendBtn, draft.trim() ? styles.sendBtnActive : ''].join(' ')}
          onClick={handleSend}
          disabled={!draft.trim() || send.isPending}
          aria-label="Отправить"
          title="Отправить (Enter)"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Main ChatModal ─────────────────────────────────────────────────────────

export function ChatModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const { activeConversationId, targetUserId, setActiveConversation } = useChatStore();
  const { data: conversations = [] } = useChatConversations();
  const startConv = useStartConversation();
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Resolve targetUserId → existing conversation or start new
  useEffect(() => {
    if (!targetUserId || conversations.length === 0) return;
    const existing = conversations.find((c) =>
      c.participants.some((p) => p.id === targetUserId),
    );
    if (existing) {
      setActiveConversation(existing.id);
    }
    // If no existing conversation found, we stay in "new DM" mode — handled below
  }, [targetUserId, conversations, setActiveConversation]);

  // Active conversation object
  const activeConv = conversations.find((c) => c.id === activeConversationId) ?? null;
  const otherParticipant = activeConv?.participants.find((p) => p.id !== user?.id);

  // "New DM" target — when targetUserId is set but no conversation found yet
  const pendingTargetName = (() => {
    if (!targetUserId || activeConversationId) return null;
    const fromConv = conversations
      .flatMap((c) => c.participants)
      .find((p) => p.id === targetUserId);
    return fromConv?.full_name ?? null;
  })();

  function handleStartConversation() {
    if (!targetUserId) return;
    startConv.mutate(targetUserId, {
      onSuccess: (data) => setActiveConversation(data.id),
      onError: () => toast.error('Не удалось создать диалог'),
    });
  }

  return (
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
        {/* ── Left panel: conversation list ── */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <MessageCircleMore size={15} className={styles.sidebarIcon} />
            <span className={styles.sidebarTitle}>Сообщения</span>
          </div>

          <div className={styles.convList}>
            {conversations.length === 0 && (
              <div className={styles.convEmpty}>
                <MessageSquareDashed size={28} className={styles.convEmptyIcon} />
                <span className={styles.convEmptyText}>Нет диалогов</span>
                <span className={styles.convEmptyHint}>
                  Нажмите на аватар сотрудника в панели справа, чтобы начать переписку
                </span>
              </div>
            )}
            {conversations.map((conv) => (
              <ConvItem
                key={conv.id}
                conv={conv}
                active={conv.id === activeConversationId}
                currentUserId={user?.id ?? ''}
                onClick={() => setActiveConversation(conv.id)}
              />
            ))}
          </div>
        </div>

        {/* ── Right panel: message thread ── */}
        <div className={styles.main}>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <X size={16} />
          </button>

          {activeConversationId && otherParticipant && (
            <MessageThread
              conversationId={activeConversationId}
              currentUserId={user?.id ?? ''}
              otherName={otherParticipant.full_name}
            />
          )}

          {/* Pending new DM — conversation not created yet */}
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

          {/* No conversation selected */}
          {!activeConversationId && !pendingTargetName && (
            <div className={styles.noConvPane}>
              <MessageCircleMore size={40} className={styles.noConvIcon} />
              <p className={styles.noConvText}>Выберите диалог или начните новый</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
