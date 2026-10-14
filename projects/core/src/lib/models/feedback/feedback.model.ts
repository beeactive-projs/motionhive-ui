import type { FeedbackCategory } from './feedback.enums';

export interface FeedbackPayload {
  type: FeedbackCategory;
  title: string;
  message: string;
  /** Optional contact email — the confirmation mail (if any) is sent here. */
  email?: string;
  /**
   * The language the confirmation mail is written in. Optional: the web
   * apps run one locale per build and the service fills it from that; the
   * mobile app switches language at runtime and says which one it is in.
   */
  language?: string;
}
