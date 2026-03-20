export const FeedbackCategories = {
  Bug: 'BUG',
  Suggestion: 'SUGGESTION',
  Other: 'OTHER',
} as const;

export type FeedbackCategory = (typeof FeedbackCategories)[keyof typeof FeedbackCategories];
