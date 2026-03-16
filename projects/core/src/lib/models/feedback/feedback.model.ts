export type FeedbackCategory = 'bug' | 'suggestion' | 'other';

export interface FeedbackPayload {
  type: FeedbackCategory;
  title: string;
  message: string;
  userId?: string;
  email?: string;
}
