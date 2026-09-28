import { enumLabel } from '../../i18n/enum-label';
import { ParticipantSnapshot } from './conversation.model';

export type UserBlockReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'SCAM'
  | 'IMPERSONATION'
  | 'OTHER';

/**
 * Reasons offered when blocking someone. "Other" stays last. Labels are
 * `enum.userBlockReason.<VALUE>`, translated when read.
 */
export const BLOCK_REASONS: readonly { value: UserBlockReason; readonly label: string }[] = (
  ['SPAM', 'HARASSMENT', 'SCAM', 'IMPERSONATION', 'OTHER'] as const
).map((value) => ({
  value,
  get label(): string {
    return enumLabel('userBlockReason', value);
  },
}));

/** BE shape from GET /messaging/blocks (with `blocked` user eager-loaded). */
export interface UserBlock {
  id: string;
  blockerId: string;
  blockedId: string;
  reason: UserBlockReason | null;
  createdAt: string;
  blocked?: ParticipantSnapshot;
}
