/**
 * SSE event payloads delivered by `GET /messaging/stream`.
 *
 * The BE assigns each event an opaque `id` (uuid). The browser EventSource
 * tracks `Last-Event-ID` automatically and replays missed events from the
 * BE's in-process ring buffer on reconnect (best-effort, 10-minute TTL).
 */

export interface MessageCreatedPayload {
  conversationId: string;
  message: {
    id: string;
    senderId: string | null;
    body: string;
    kind: string;
    createdAt: string;
  };
}

export interface MessageDeletedPayload {
  conversationId: string;
  messageId: string;
}

export interface ConversationReadPayload {
  conversationId: string;
  userId: string;
  lastReadAt: string;
}

export interface ConversationMutedPayload {
  conversationId: string;
  userId: string;
  mutedUntil: string | null;
}

export type MessagingStreamEvent =
  | { type: 'message.created'; payload: MessageCreatedPayload }
  | { type: 'message.deleted'; payload: MessageDeletedPayload }
  | { type: 'conversation.read'; payload: ConversationReadPayload }
  | { type: 'conversation.muted'; payload: ConversationMutedPayload }
  | { type: 'heartbeat'; payload: { ts: number } };

/** Wrapped at the EventSource level — `id` comes from SSE's id: line. */
export interface MessagingStreamEnvelope {
  id: string;
  event: MessagingStreamEvent;
}
