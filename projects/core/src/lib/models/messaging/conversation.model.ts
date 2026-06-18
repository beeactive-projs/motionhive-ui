/**
 * BE contract for `/messaging/conversations` and `/messaging/conversations/:id`.
 * Camel-case is enforced by the BE's global CamelCaseInterceptor — these
 * shapes match the wire payload 1:1.
 *
 * v1 only writes DIRECT conversations. GROUP support exists in the
 * schema and is reserved for v2.
 */
export type ConversationType = 'DIRECT' | 'GROUP';

export interface ParticipantSnapshot {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface ConversationListItem {
  id: string;
  type: ConversationType;
  /** Group name. Always null for DIRECT in v1. */
  name: string | null;
  /** Group avatar. Always null for DIRECT in v1. */
  avatarUrl: string | null;
  /** ISO timestamp of the most recent message. Null when the conversation has no messages yet. */
  lastMessageAt: string | null;
  /** Truncated plaintext preview (≤200 chars on the server). */
  lastMessagePreview: string | null;
  unreadCount: number;
  muted: boolean;
  /** DIRECT only — the other participant. Null for groups. */
  otherUser: ParticipantSnapshot | null;
  /**
   * DIRECT only — ISO timestamp of the other participant's last read.
   * Powers the read receipt on the caller's own messages. Null for groups,
   * or when the other side has never read the thread.
   */
  lastReadByOther: string | null;
}
