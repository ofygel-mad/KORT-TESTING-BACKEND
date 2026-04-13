import { useState } from 'react';
import { Check, CheckCheck, Clock, MoreVertical } from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from '../../../shared/ui/ContextMenu';
import { ReplyQuote } from './ReplyQuote';
import { AttachmentPreview } from './AttachmentPreview';
import { OrderRefCard } from './OrderRefCard';
import type { ChatMessage } from '../types';
import styles from './Bubble.module.css';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

interface ReadTickProps {
  msg: ChatMessage;
}

function ReadTick({ msg }: ReadTickProps) {
  if (msg.id.startsWith('optimistic-')) {
    return <Clock size={11} className={styles.tickClock} />;
  }
  if (msg.read_at) {
    return <CheckCheck size={11} className={styles.tickRead} />;
  }
  return <Check size={11} className={styles.tickSent} />;
}

interface Props {
  msg: ChatMessage;
  isMine: boolean;
  isOptimistic?: boolean;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onQuoteClick?: (replyToId: string) => void;
}

export function Bubble({ msg, isMine, isOptimistic, onReply, onEdit, onDelete, onQuoteClick }: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const isDeleted = !!msg.deleted_at;

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  const menuItems: ContextMenuItem[] = [
    ...(onReply && !isDeleted ? [{ label: 'Ответить', onClick: onReply }] : []),
    ...(msg.type === 'TEXT' && !isDeleted ? [{ label: 'Копировать', onClick: () => navigator.clipboard.writeText(msg.body).catch(() => {}) }] : []),
    ...(isMine && onEdit && !isDeleted && !msg.edited_at && msg.type === 'TEXT' ? [{ label: 'Изменить', onClick: onEdit }] : []),
    ...(isMine && onDelete && !isDeleted ? [{ label: 'Удалить', danger: true, onClick: onDelete }] : []),
  ];

  return (
    <>
      <div
        className={[
          styles.row,
          isMine ? styles.rowMine : styles.rowTheirs,
        ].join(' ')}
        data-message-id={msg.id}
        onContextMenu={menuItems.length > 0 ? handleContextMenu : undefined}
      >
        <div className={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          isOptimistic ? styles.bubbleOptimistic : '',
          isDeleted ? styles.bubbleDeleted : '',
        ].join(' ')}>
          {/* Reply quote */}
          {msg.reply_to && !isDeleted && (
            <ReplyQuote
              reply={msg.reply_to}
              onClick={() => msg.reply_to_id && onQuoteClick?.(msg.reply_to_id)}
            />
          )}

          {/* Content */}
          {isDeleted ? (
            <span className={styles.deletedText}>Сообщение удалено</span>
          ) : msg.type === 'ORDER_REF' && msg.order_id ? (
            <OrderRefCard orderId={msg.order_id} />
          ) : msg.attachment ? (
            <AttachmentPreview attachment={msg.attachment} />
          ) : (
            <span className={styles.bodyText}>{msg.body}</span>
          )}

          {/* Meta row */}
          {!isDeleted && (
            <div className={styles.meta}>
              {msg.edited_at && <span className={styles.editedLabel}>изменено</span>}
              <span className={styles.time}>{formatTime(msg.created_at)}</span>
              {isMine && <ReadTick msg={msg} />}
            </div>
          )}
        </div>

        {/* Context menu trigger for own messages */}
        {menuItems.length > 0 && (
          <button
            className={styles.menuBtn}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setContextMenu({ x: r.left, y: r.bottom });
            }}
            aria-label="Действия с сообщением"
          >
            <MoreVertical size={13} />
          </button>
        )}
      </div>

      {contextMenu && menuItems.length > 0 && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
