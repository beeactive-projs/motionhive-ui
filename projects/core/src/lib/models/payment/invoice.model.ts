import type { InvoiceStatus } from './payment.enums';
import type { PaginatedResponse } from '../common/pagination.model';

export interface InvoiceLineItem {
  description: string;
  amountCents: number;
  quantity: number;
}

export interface InvoiceLineItemDetail {
  id: string;
  description: string | null;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
  currency: string;
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
  finalizedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
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
  guestEmail?: string;
  guestName?: string;
  lineItems: InvoiceLineItem[];
  dueDate?: string;
  description?: string;
  currency?: string;
  sendImmediately?: boolean;
  requiresImmediateAccessWaiver?: boolean;
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

/**
 * Body for `POST /payments/my/invoices/:id/pay`.
 *
 * The server owns the canonical consent record — we just confirm the
 * waiver was ticked. The backend refuses to pay the invoice if the
 * flag is missing when the invoice requires the 14-day waiver.
 */
export interface PayInvoicePayload {
  immediateAccessWaiverAccepted?: boolean;
}

export interface PayInvoiceResponse {
  url: string;
}
