import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  IonButton,
  IonCard,
  IonIcon,
  IonItem,
  IonLabel,
  IonNote,
  IonSkeletonText,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add } from 'ionicons/icons';

import { formatMinorUnits } from 'core';

import { StatTile } from '../../../_shared/components/stat-tile/stat-tile';
import { CoachHomeStore } from './coach-home.store';

@Component({
  selector: 'mh-coach-home',
  imports: [
    DatePipe,
    IonButton,
    IonCard,
    IonIcon,
    IonItem,
    IonLabel,
    IonNote,
    IonSkeletonText,
    StatTile,
    TranslatePipe,
  ],
  templateUrl: './coach-home.html',
  styleUrl: './coach-home.scss',
  providers: [CoachHomeStore],
})
export class CoachHome implements OnInit, ViewWillEnter {
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);

  readonly store = inject(CoachHomeStore);

  /** Re-read on every entry: a tab page kept alive overnight would date itself. */
  readonly today = signal(new Date());

  constructor() {
    addIcons({ add });
  }

  ngOnInit(): void {
    this.store.load();
  }

  /** Tab pages stay alive, so re-entering must refresh or the banner goes stale. */
  ionViewWillEnter(): void {
    this.today.set(new Date());
    this.store.refresh();
  }

  /** Amount is in minor units and the currency is the coach's own Stripe currency. */
  outstanding(): string {
    const summary = this.store.earnings();
    if (!summary) return '—';
    const amount = formatMinorUnits(summary.outstandingInvoicesCents);
    return `${amount} ${summary.currency.toUpperCase()}`;
  }

  hasOverdue(): boolean {
    return (this.store.earnings()?.overdueInvoiceCount ?? 0) > 0;
  }

  outstandingHint(): string {
    const overdue = this.store.earnings()?.overdueInvoiceCount ?? 0;
    if (overdue === 0) return this._translateService.instant('home.coach.outstanding.nothingOverdue');
    return this._translateService.instant('home.coach.outstanding.overdue', { count: overdue });
  }

  requestsSummary(): string {
    return this._translateService.instant('home.coach.requests.summary', {
      count: this.store.pendingRequests(),
    });
  }

  openRequests(): void {
    void this._router.navigateByUrl('/tabs/clients/requests');
  }

  openSessions(): void {
    void this._router.navigateByUrl('/tabs/coach/sessions');
  }
}
