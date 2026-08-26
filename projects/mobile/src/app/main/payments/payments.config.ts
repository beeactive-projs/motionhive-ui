import { InvoiceStatus, InvoiceStatuses } from 'core';
import {
  addOutline,
  alertCircleOutline,
  banOutline,
  cardOutline,
  cashOutline,
  checkmarkCircleOutline,
  chevronForward,
  documentTextOutline,
  lockClosedOutline,
  openOutline,
  personOutline,
  receiptOutline,
  refreshOutline,
  timeOutline,
} from 'ionicons/icons';

/** Every icon the payments screens render, registered once per page. */
export const PAYMENT_ICONS = {
  addOutline,
  alertCircleOutline,
  banOutline,
  cardOutline,
  cashOutline,
  checkmarkCircleOutline,
  chevronForward,
  documentTextOutline,
  lockClosedOutline,
  openOutline,
  personOutline,
  receiptOutline,
  refreshOutline,
  timeOutline,
};

/**
 * How an invoice reads on a row.
 *
 * `chip` is deliberately null for OPEN: it is the default state on the coach's
 * hub, and a chip on every row turns the exceptions invisible. The spine and
 * the section heading carry the ordinary case; only the unusual ones speak.
 */
export interface InvoiceStatusStyle {
  label: string;
  chip: string | null;
  tone: 'honey' | 'emerald' | 'slate' | 'coral';
}

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus, InvoiceStatusStyle> = {
  [InvoiceStatuses.Draft]: { label: 'Draft', chip: 'Draft', tone: 'slate' },
  [InvoiceStatuses.Open]: { label: 'Open', chip: null, tone: 'honey' },
  [InvoiceStatuses.Paid]: { label: 'Paid', chip: null, tone: 'emerald' },
  [InvoiceStatuses.Void]: { label: 'Void', chip: 'Void', tone: 'slate' },
  [InvoiceStatuses.Uncollectible]: {
    label: 'Uncollectible',
    chip: 'Uncollectible',
    tone: 'slate',
  },
};

export function invoiceStatusStyle(status: InvoiceStatus): InvoiceStatusStyle {
  return INVOICE_STATUS_STYLES[status] ?? INVOICE_STATUS_STYLES[InvoiceStatuses.Draft];
}

/** The coach's filter rail, mirroring the web app's tabs. */
export const INVOICE_FILTERS = [
  { value: null, label: 'All' },
  { value: InvoiceStatuses.Open, label: 'Open' },
  { value: InvoiceStatuses.Paid, label: 'Paid' },
  { value: InvoiceStatuses.Draft, label: 'Draft' },
  { value: InvoiceStatuses.Void, label: 'Void' },
] as const;

/** Stripe's refund window, mirrored from `RefundService` on the API. */
export const REFUND_WINDOW_DAYS = 14;

/** Whole days left to refund a payment, or 0 once the window has closed. */
export function refundDaysLeft(paidAt: string | null | undefined): number {
  if (!paidAt) return 0;
  const closesAt = new Date(paidAt).getTime() + REFUND_WINDOW_DAYS * 86_400_000;
  return Math.max(0, Math.ceil((closesAt - Date.now()) / 86_400_000));
}

/** An invoice past its due date and still unpaid — the coach's own section. */
export function isOverdue(status: InvoiceStatus, dueDate: string | null): boolean {
  if (status !== InvoiceStatuses.Open || !dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

/**
 * Money as a plain string, for the places a pipe cannot reach — sheet facts
 * are passed as data, not rendered in a template. Same shape the pipe
 * produces, so an amount never reads two ways in one flow.
 */
export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: (currency || 'RON').toUpperCase(),
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
