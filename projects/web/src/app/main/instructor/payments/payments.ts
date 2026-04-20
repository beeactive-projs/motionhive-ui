import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Earnings } from './earnings/earnings';
import { Invoices } from './invoices/invoices';
import { Subscriptions } from './subscriptions/subscriptions';
import { Products } from './products/products';

export const PaymentTabs = {
  Overview: 'overview',
  Invoices: 'invoices',
  Memberships: 'memberships',
  Pricing: 'pricing',
} as const;

export type PaymentTab = (typeof PaymentTabs)[keyof typeof PaymentTabs];

const VALID_TABS = new Set<string>(Object.values(PaymentTabs));

@Component({
  selector: 'mh-payments',
  imports: [Tabs, TabList, Tab, TabPanels, TabPanel, Earnings, Invoices, Subscriptions, Products],
  templateUrl: './payments.html',
  styleUrl: './payments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Payments {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  readonly Tabs = PaymentTabs;

  private readonly _queryParams = toSignal(this._route.queryParamMap, {
    initialValue: this._route.snapshot.queryParamMap,
  });

  readonly activeTab = computed<PaymentTab>(() => {
    const tab = this._queryParams().get('tab');
    return tab && VALID_TABS.has(tab) ? (tab as PaymentTab) : PaymentTabs.Overview;
  });

  onTabChange(value: string | number | undefined): void {
    const tab = typeof value === 'string' && VALID_TABS.has(value) ? value : PaymentTabs.Overview;
    if (tab === this.activeTab()) return;
    this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }
}
