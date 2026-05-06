import type { ChatMessageReplyPreview } from '../types';
import styles from './ReplyQuote.module.css';

interface Props {
  reply: ChatMessageReplyPreview;
  onClick?: () => void;
}

export function ReplyQuote({ reply, onClick }: Props) {
  const preview =
    reply.type === 'IMAGE'
      ? '📷 Изображение'
      : reply.type === 'FILE'
        ? '📎 Файл'
        : reply.type === 'ORDER_REF'
          ? '📋 Заказ'
          : reply.body;

  return (
    <button className={styles.root} onClick={onClick} title="Перейти к сообщению">
      <div className={styles.bar} />
      <div className={styles.content}>
        <span className={styles.sender}>{reply.sender_name}</span>
        <span className={styles.preview}>{preview}</span>
      </div>
    </button>
  );
}
