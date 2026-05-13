export type MessageReportCategory =
  | 'SPAM'
  | 'SCAM'
  | 'HARASSMENT'
  | 'IMPERSONATION'
  | 'SEXUAL'
  | 'OTHER';

/** Submit payload — at least one of messageId/conversationId is required. */
export interface ReportMessagePayload {
  messageId?: string;
  conversationId?: string;
  category: MessageReportCategory;
  notes?: string;
}
