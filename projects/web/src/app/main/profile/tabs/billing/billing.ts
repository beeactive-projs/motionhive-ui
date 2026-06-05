import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MyInvoices } from '../../../user/payments/my-invoices/my-invoices';
import { MySubscriptions } from '../../../user/payments/my-subscriptions/my-subscriptions';

type BillingView = 'invoices' | 'memberships';

/**
 * Billing tab — the single home for a user's billing.
 *
 * Invoices and memberships used to stack as two full paginated tables,
 * which read as two pages crammed into one. Here they live behind a
 * compact segmented toggle so only one is on screen at a time, under a
 * single header. Each child still owns its own empty state and the
 * memberships view carries the Stripe "Manage billing" portal button.
 */
@Component({
  selector: 'mh-profile-billing',
  imports: [MyInvoices, MySubscriptions],
  templateUrl: './billing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileBilling {
  readonly view = signal<BillingView>('invoices');
}
