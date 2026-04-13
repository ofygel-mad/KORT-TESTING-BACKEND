import { useRef, useState, type KeyboardEvent } from 'react';
import { Plus, Send, X, Reply, Edit2 } from 'lucide-react';
import { useChatStore } from '../../../shared/stores/chat';
import { useTypingBroadcast } from '../hooks/useTypingBroadcast';
import type { ChatMessage } from '../types';
import styles from './ChatInput.module.css';

interface Props {
  conversationId: string;
  currentUserId: string;
  currentUserName: string;
  otherParticipantName: string;
  onSendText: (body: string, replyToId?: string | null) => void;
  onSendFile: (file: File) => void;
  onConfirmEdit: (body: string) => void;
  isSending?: boolean;
}

export function ChatInput({
  conversationId,
  currentUserId,
  currentUserName,
  otherParticipantName,
  onSendText,
  onSendFile,
  onConfirmEdit,
  isSending,
}: Props) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { replyingTo, editingMessage, setReplyingTo, setEditingMessage } = useChatStore();
  const { onKeystroke, stop } = useTypingBroadcast(conversationId);

  // When editingMessage changes, pre-fill the textarea
  const prevEditingRef = useRef<ChatMessage | null>(null);
  if (editingMessage !== prevEditingRef.current) {
    prevEditingRef.current = editingMessage;
    if (editingMessage) {
      setDraft(editingMessage.body);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setDraft('');
    }
  }

  function handleSend() {
    const body = draft.trim();
    if (!body) return;

    if (editingMessage) {
      onConfirmEdit(body);
      setEditingMessage(null);
    } else {
      onSendText(body, replyingTo?.id ?? null);
      setReplyingTo(null);
    }

    setDraft('');
    stop();
    setTimeout(() => inputRef.current?.focus(), 10);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setReplyingTo(null);
      setEditingMessage(null);
      setDraft('');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    onKeystroke();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onSendFile(file);
    e.target.value = '';
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onSendFile(file);
  }

  const isEditing = !!editingMessage;
  const isReplying = !!replyingTo && !isEditing;

  return (
    <div
      className={[styles.wrapper, isDragging ? styles.wrapperDragging : ''].join(' ')}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Reply / Edit bar */}
      {(isReplying || isEditing) && (
        <div className={styles.contextBar}>
          {isEditing ? (
            <Edit2 size={13} className={styles.contextBarIcon} />
          ) : (
            <Reply size={13} className={styles.contextBarIcon} />
          )}
          <div className={styles.contextBarContent}>
            <span className={styles.contextBarLabel}>
              {isEditing
                ? 'Редактирование'
                : `Ответ: ${replyingTo!.sender_id === currentUserId ? currentUserName : otherParticipantName}`}
            </span>
            <span className={styles.contextBarPreview}>
              {isEditing ? editingMessage!.body.slice(0, 60) : replyingTo!.body.slice(0, 60)}
            </span>
          </div>
          <button
            className={styles.contextBarClose}
            onClick={() => { setReplyingTo(null); setEditingMessage(null); setDraft(''); }}
            aria-label="Отмена"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div className={styles.dropOverlay}>
          <span>Отпустите файл для отправки</span>
        </div>
      )}

      {/* Input row */}
      <div className={styles.inputRow}>
        <button
          className={styles.attachBtn}
          title="Прикрепить файл"
          aria-label="Прикрепить файл"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <textarea
          ref={inputRef}
          className={styles.messageInput}
          placeholder="Напишите сообщение..."
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={4000}
        />
        <button
          className={[styles.sendBtn, (draft.trim() && !isSending) ? styles.sendBtnActive : ''].join(' ')}
          onClick={handleSend}
          disabled={!draft.trim() || isSending}
          aria-label="Отправить"
          title="Отправить (Enter)"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
