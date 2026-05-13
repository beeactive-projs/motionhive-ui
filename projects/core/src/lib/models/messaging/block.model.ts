import { ParticipantSnapshot } from './conversation.model';

export type UserBlockReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'SCAM'
  | 'IMPERSONATION'
  | 'OTHER';

/** BE shape from GET /messaging/blocks (with `blocked` user eager-loaded). */
export interface UserBlock {
  id: string;
  blockerId: string;
  blockedId: string;
  reason: UserBlockReason | null;
  createdAt: string;
  blocked?: ParticipantSnapshot;
}
