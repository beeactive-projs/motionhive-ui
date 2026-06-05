import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MyInvoices } from '../../../user/payments/my-invoices/my-invoices';
import { MySubscriptions } from '../../../user/payments/my-subscriptions/my-subscriptions';

/**
 * Billing tab — the single, always-present home for a user's billing.
 *
 * Consolidates the two formerly-conditional tabs (Invoices + Memberships)
 * into one section so the account-menu "Billing & payments" link always
 * lands somewhere real, even with zero billing activity. Each child owns
 * its own empty state ("No invoices yet" / "No subscriptions") and the
 * memberships block carries the Stripe "Manage billing" portal button.
 */
@Component({
  selector: 'mh-profile-billing',
  imports: [MyInvoices, MySubscriptions],
  templateUrl: './billing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileBilling {}
