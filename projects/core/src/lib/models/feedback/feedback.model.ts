export const FeedbackCategories = {
  Bug: 'bug',
  Suggestion: 'suggestion',
  Other: 'other',
} as const;

export type FeedbackCategory = (typeof FeedbackCategories)[keyof typeof FeedbackCategories];

export interface FeedbackPayload {
  type: FeedbackCategory;
  title: string;
  message: string;
  userId?: string;
  email?: string;
}
