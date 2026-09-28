import { InvoiceStatus, InvoiceStatuses, appLocale, enumLabel } from 'core';
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
  readonly label: string;
  readonly chip: string | null;
  readonly tone: 'honey' | 'emerald' | 'slate' | 'coral';
}

/**
 * Labels are getters over `enum.invoiceStatus.*`: this table is a module
 * constant, evaluated before the language file has loaded.
 */
function statusStyle(
  status: InvoiceStatus,
  tone: InvoiceStatusStyle['tone'],
  showChip: boolean,
): InvoiceStatusStyle {
  return {
    get label() {
      return enumLabel('invoiceStatus', status);
    },
    get chip() {
      return showChip ? enumLabel('invoiceStatus', status) : null;
    },
    tone,
  };
}

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus, InvoiceStatusStyle> = {
  [InvoiceStatuses.Draft]: statusStyle(InvoiceStatuses.Draft, 'slate', true),
  [InvoiceStatuses.Open]: statusStyle(InvoiceStatuses.Open, 'honey', false),
  [InvoiceStatuses.Paid]: statusStyle(InvoiceStatuses.Paid, 'emerald', false),
  [InvoiceStatuses.Void]: statusStyle(InvoiceStatuses.Void, 'slate', true),
  [InvoiceStatuses.Uncollectible]: statusStyle(InvoiceStatuses.Uncollectible, 'slate', true),
};

export function invoiceStatusStyle(status: InvoiceStatus): InvoiceStatusStyle {
  return INVOICE_STATUS_STYLES[status] ?? INVOICE_STATUS_STYLES[InvoiceStatuses.Draft];
}

/**
 * The coach's filter rail, mirroring the web app's tabs. `label` is a
 * translation key — the template translates it.
 */
export const INVOICE_FILTERS = [
  { value: null, label: 'common.all' },
  { value: InvoiceStatuses.Open, label: 'enum.invoiceStatus.open' },
  { value: InvoiceStatuses.Paid, label: 'enum.invoiceStatus.paid' },
  { value: InvoiceStatuses.Draft, label: 'enum.invoiceStatus.draft' },
  { value: InvoiceStatuses.Void, label: 'enum.invoiceStatus.void' },
] as const;

/** Invoices / Memberships, shared by the coach hub and the client's bills. */
export const PAYMENT_SEGMENTS = [
  { value: 'invoices', label: 'payments.segment.invoices' },
  { value: 'memberships', label: 'payments.segment.memberships' },
] as const;

export type PaymentSegment = (typeof PAYMENT_SEGMENTS)[number]['value'];

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
  return new Intl.NumberFormat(appLocale(), {
    style: 'currency',
    currency: (currency || 'RON').toUpperCase(),
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * The bare number, two decimals, no grouping — for copy that names the
 * currency itself ("Pay 50.00 RON on Stripe").
 */
export function formatAmount(cents: number): string {
  return new Intl.NumberFormat(appLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(cents / 100);
}
