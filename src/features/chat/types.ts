export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'ORDER_REF';

export interface ChatParticipant {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  phone?: string | null;
}

export interface ChatAttachment {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
}

export interface ChatMessageReplyPreview {
  id: string;
  sender_name: string;
  body: string;
  type: MessageType;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  type: MessageType;
  reply_to_id?: string | null;
  reply_to?: ChatMessageReplyPreview | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  order_id?: string | null;
  attachment?: ChatAttachment | null;
  created_at: string;
  read_at?: string | null;
}

export interface ChatConversation {
  id: string;
  participants: ChatParticipant[];
  last_message?: ChatMessage | null;
  unread_count: number;
  my_last_read_at?: string | null;
  updated_at: string;
}

export interface OrderPreview {
  id: string;
  order_number: string;
  status: string;
  client_name: string;
  total_amount: number;
  created_at: string;
}
