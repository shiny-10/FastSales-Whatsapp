export type ConversationStatus = "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "DOCUMENT"
  | "TEMPLATE"
  | "STICKER"
  | "LOCATION"
  | "CONTACTS"
  | "INTERACTIVE"
  | "REACTION"
  | "UNSUPPORTED";
export type MessageStatus = "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
export type SenderType = "CUSTOMER" | "AGENT" | "SYSTEM";

export interface MediaFile {
  id: string;
  media_id?: string;
  file_name?: string;
  file_url?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface Reaction {
  id: string;
  message_id: string;
  emoji: string;
  customer_phone: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  meta_message_id?: string;
  sender_type: SenderType;
  sender_id?: string;
  message_type: MessageType;
  content?: string;
  caption?: string;
  status: MessageStatus;
  is_deleted: boolean;
  reply_to_message_id?: string;
  media_files: MediaFile[];
  reactions: Reaction[];
  created_at: string;
}

export interface Conversation {
  id: string;
  company_id: string;
  customer_phone: string;
  customer_name?: string;
  assigned_agent_id?: string;
  status: ConversationStatus;
  is_archived: boolean;
  unread_count: number;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
  last_message_preview?: string;
}

export interface ConversationListResponse {
  items: Conversation[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface MessageListResponse {
  items: Message[];
  total: number;
  has_more: boolean;
  cursor?: string;
}

export interface WhatsAppAccount {
  id: string;
  company_id: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number?: string;
  verified_name?: string;
  status: string;
  webhook_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppStatusResponse {
  connected: boolean;
  account?: WhatsAppAccount;
  message: string;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  customers: string[];
}

export interface MessageReactionsResponse {
  message_id: string;
  reactions: ReactionGroup[];
  total: number;
}
