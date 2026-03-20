import type { FeedbackCategory } from './feedback.enums';

export interface FeedbackPayload {
  type: FeedbackCategory;
  title: string;
  message: string;
  userId?: string;
  email?: string;
}
