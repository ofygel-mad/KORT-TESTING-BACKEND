export interface ChatParticipant {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  phone?: string | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at?: string | null;
}

export interface ChatConversation {
  id: string;
  participants: ChatParticipant[];
  last_message?: ChatMessage | null;
  unread_count: number;
  updated_at: string;
}
