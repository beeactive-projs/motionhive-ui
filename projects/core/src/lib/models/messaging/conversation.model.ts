import type { RequestContext } from './requests.model';
import type { ShareTargetType } from './share.model';

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
  /** Null until the user picks one. Addresses their public profile. */
  handle: string | null;
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
  /**
   * The reader marked the thread unread ("come back to this"). Independent
   * of `unreadCount`, which only counts real unread messages. Optional so a
   * response from an API without the field reads as not marked.
   */
  markedUnread?: boolean;
  /** DIRECT only — the other participant. Null for groups. */
  otherUser: ParticipantSnapshot | null;
  /**
   * DIRECT only — ISO timestamp of the other participant's last read.
   * Powers the read receipt on the caller's own messages. Null for groups,
   * or when the other side has never read the thread. Null too while they
   * haven't accepted the reader's message request (no receipts until then).
   */
  lastReadByOther: string | null;
  /**
   * The reader hasn't taken this chat in: it waits in their message
   * requests. Optional: older APIs don't send it (read as false).
   */
  isRequest?: boolean;
  /** For a request: how the two might know each other. */
  requestContext?: RequestContext | null;
  /** The reader archived it: out of the chats, and quiet. */
  archived?: boolean;
  /**
   * The other person hasn't accepted the reader's request yet; `remaining`
   * is how many more messages fit until they do. Null when nothing waits.
   */
  waiting?: { remaining: number } | null;
  /** The last message shared a thing of this type: "Session · <preview>". */
  lastMessageAttachmentType?: ShareTargetType | null;
}
