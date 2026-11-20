/**
 * Message requests and "Who can message you" (API migration 090,
 * `beeactive-api/docs/research/messaging/WHO_CAN_MESSAGE.md`).
 */

/** Which part of the inbox to list. Omitted: everything, as before. */
export const ConversationFolder = {
  Inbox: 'inbox',
  Requests: 'requests',
  Archived: 'archived',
} as const;
export type ConversationFolder = (typeof ConversationFolder)[keyof typeof ConversationFolder];

/** How the writer of a request and its reader might know each other. */
export interface RequestContext {
  sharedGroupName: string | null;
  sharedGroupCount: number;
  isCoach: boolean;
}

/** "Who can message you". REQUESTS is the default. */
export const WhoCanMessage = {
  Everyone: 'EVERYONE',
  Requests: 'REQUESTS',
  Connections: 'CONNECTIONS',
} as const;
export type WhoCanMessage = (typeof WhoCanMessage)[keyof typeof WhoCanMessage];

export interface MessagingSettings {
  whoCanMessage: WhoCanMessage;
}

/** `GET /messaging/reach/:userId`: what happens if I write to them. */
export const ReachStatus = {
  Direct: 'DIRECT',
  Request: 'REQUEST',
  ConnectionsOnly: 'CONNECTIONS_ONLY',
  YouBlocked: 'YOU_BLOCKED',
  NewAccount: 'NEW_ACCOUNT',
  Suspended: 'SUSPENDED',
} as const;
export type ReachStatus = (typeof ReachStatus)[keyof typeof ReachStatus];

export interface MessagingReach {
  status: ReachStatus;
  /** For REQUEST: how many messages fit before they accept. */
  requestLimit: number | null;
}

/** `GET /messaging/unread-count`. `inbox` and `requests` from the API with requests. */
export interface MessagingUnreadCount {
  count: number;
  inbox?: number;
  requests?: number;
}
