import type { PaymentStatus, RefundReason } from './payment.enums';
import type { PaginatedResponse } from '../common/pagination.model';

export interface Payment {
  id: string;
  invoiceId: string | null;
  instructorId: string;
  clientId: string | null;
  stripePaymentIntentId: string;
  stripeChargeId: string | null;
  amountCents: number;
  amountRefundedCents: number;
  currency: string;
  applicationFeeCents: number;
  status: PaymentStatus;
  paymentMethodType: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRefundPayload {
  paymentId: string;
  amountCents?: number;
  reason?: RefundReason;
  notes?: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  amountCents: number;
  reason: RefundReason | null;
  stripeRefundId: string;
  createdAt: string;
}

export interface PaymentListParams {
  status?: PaymentStatus;
  clientId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export type PaymentListResponse = PaginatedResponse<Payment>;
