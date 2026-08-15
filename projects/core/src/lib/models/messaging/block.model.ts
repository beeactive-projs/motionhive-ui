import { ParticipantSnapshot } from './conversation.model';

export type UserBlockReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'SCAM'
  | 'IMPERSONATION'
  | 'OTHER';

/** Reasons offered when blocking someone. "Other" stays last. */
export const BLOCK_REASONS: readonly { value: UserBlockReason; label: string }[] = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'SCAM', label: 'Scam' },
  { value: 'IMPERSONATION', label: 'Impersonation' },
  { value: 'OTHER', label: 'Other' },
];

/** BE shape from GET /messaging/blocks (with `blocked` user eager-loaded). */
export interface UserBlock {
  id: string;
  blockerId: string;
  blockedId: string;
  reason: UserBlockReason | null;
  createdAt: string;
  blocked?: ParticipantSnapshot;
}
