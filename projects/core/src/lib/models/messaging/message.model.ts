/**
 * BE contract for individual messages. `MessageView` matches the
 * `toMessageView` shape from the API service.
 *
 * `body` is the only plaintext field — render it as text, never HTML.
 * Soft-deleted messages have `deletedAt` set and `body === '[deleted]'`
 * (the FE never has to compute the tombstone; the BE does it).
 */
export type MessageKind =
  | 'TEXT'
  | 'SYSTEM_JOIN'
  | 'SYSTEM_LEAVE'
  | 'SYSTEM_RENAME'
  | 'SYSTEM_ROLE_CHANGE';

export interface MessageView {
  id: string;
  conversationId: string;
  /** Null for SYSTEM_* messages. Always set for TEXT. */
  senderId: string | null;
  kind: MessageKind;
  body: string;
  /** ISO timestamp when the sender soft-deleted the message. Null otherwise. */
  deletedAt: string | null;
  createdAt: string;
}

/**
 * BE-computed threat flags attached to the SEND response. The FE shows
 * a banner inside the sender's own thread when `anyFlag` is true; the
 * recipient never sees these (BE deliberately doesn't expose them via
 * SSE).
 */
export interface ThreatFlags {
  urls: string[];
  hasShortenerUrl: boolean;
  hasOffPlatformContact: boolean;
  hasPaymentHandle: boolean;
  anyFlag: boolean;
}

/**
 * Shape of the POST /messaging/messages response.
 *
 * `delivered` is `false` for silent-drops (recipient blocked sender,
 * recipient doesn't exist, etc.). The FE renders both branches
 * identically — `delivered` is for diagnostics only.
 */
export interface SendMessageResult {
  message: MessageView;
  conversation: import('./conversation.model').ConversationListItem;
  delivered: boolean;
  threatFlags: ThreatFlags;
}

/** Cursor-based message page. */
export interface MessagePage {
  items: MessageView[];
  /** Pass this as `before=` on the next call. Null when no more pages. */
  nextBefore: string | null;
}
