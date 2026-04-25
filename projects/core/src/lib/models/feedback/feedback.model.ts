import type { FeedbackCategory } from './feedback.enums';

export interface FeedbackPayload {
  type: FeedbackCategory;
  title: string;
  message: string;
  /** Optional contact email — the confirmation mail (if any) is sent here. */
  email?: string;
}
