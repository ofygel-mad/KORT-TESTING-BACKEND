import { useRef } from 'react';
import { chatSocketSendRef } from '../useChatSocket';

/**
 * Sends typing.start on every keystroke, then typing.stop after 2s of silence.
 */
export function useTypingBroadcast(conversationId: string | null) {
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  function onKeystroke() {
    if (!conversationId || !chatSocketSendRef.current) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      chatSocketSendRef.current({ type: 'typing.start', conversation_id: conversationId });
    }

    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      chatSocketSendRef.current?.({ type: 'typing.stop', conversation_id: conversationId });
    }, 2000);
  }

  function stop() {
    if (!conversationId || !chatSocketSendRef.current) return;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      chatSocketSendRef.current({ type: 'typing.stop', conversation_id: conversationId });
    }
  }

  return { onKeystroke, stop };
}
