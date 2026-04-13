import type { ConsentType, InvoiceStatus } from './payment.enums';
import type { PaginatedResponse } from '../common/pagination.model';

export interface InvoiceLineItem {
  description: string;
  amountCents: number;
  quantity: number;
}

export interface InvoiceClientSummary {
  id: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface Invoice {
  id: string;
  instructorId: string;
  clientId: string | null;
  clientEmail: string;
  subscriptionId: string | null;
  stripeInvoiceId: string;
  number: string | null;
  status: InvoiceStatus;
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  applicationFeeCents: number;
  dueDate: string | null;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  paidOutOfBand: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  client?: InvoiceClientSummary | null;
  lineItems?: InvoiceLineItem[];
}

export interface CreateInvoicePayload {
  clientUserId?: string;
  clientEmail?: string;
  clientFirstName?: string;
  clientLastName?: string;
  lineItems: InvoiceLineItem[];
  dueDate?: string;
  description?: string;
  currency?: string;
  sendImmediately?: boolean;
}

export interface InvoiceListParams {
  status?: InvoiceStatus;
  clientId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export type InvoiceListResponse = PaginatedResponse<Invoice>;

export interface PayInvoiceConsent {
  consentType: ConsentType;
  consentText: string;
}

export interface PayInvoiceResponse {
  checkoutUrl: string;
}
