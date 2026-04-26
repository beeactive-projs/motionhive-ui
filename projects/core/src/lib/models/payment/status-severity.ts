import { TagSeverity } from '../common/ui.enums';
import {
  InvoiceStatus,
  InvoiceStatuses,
  SubscriptionStatus,
  SubscriptionStatuses,
} from './payment.enums';

/**
 * Maps an invoice status to the PrimeNG Tag severity colour. Single
 * source of truth so instructor + client tables render identical
 * colours for the same state.
 */
export function getInvoiceStatusSeverity(status: InvoiceStatus): TagSeverity {
  switch (status) {
    case InvoiceStatuses.Paid:
      return TagSeverity.Success;
    case InvoiceStatuses.Open:
      return TagSeverity.Warn;
    case InvoiceStatuses.Draft:
      return TagSeverity.Secondary;
    case InvoiceStatuses.Void:
    case InvoiceStatuses.Uncollectible:
      return TagSeverity.Danger;
    default:
      return TagSeverity.Secondary;
  }
}

/**
 * Maps a subscription status to the PrimeNG Tag severity colour.
 * Keeps instructor memberships + client billing in visual sync.
 */
export function getSubscriptionStatusSeverity(
  status: SubscriptionStatus,
): TagSeverity {
  switch (status) {
    case SubscriptionStatuses.Active:
      return TagSeverity.Success;
    case SubscriptionStatuses.Trialing:
      return TagSeverity.Info;
    case SubscriptionStatuses.PastDue:
      return TagSeverity.Warn;
    case SubscriptionStatuses.Canceled:
    case SubscriptionStatuses.Unpaid:
      return TagSeverity.Danger;
    default:
      return TagSeverity.Secondary;
  }
}
