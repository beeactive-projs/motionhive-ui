import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import { MyTab, SessionParticipant, SessionService } from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { MySessionRow } from '../_components/my-session-row/my-session-row';
import { MY_SESSION_ICONS } from '../my-sessions.config';

const PAGE_SIZE = 50;

/**
 * The list behind the "Cancelled & declined" ghost row — every booking that
 * ended without a session, muted on purpose. The BE's `cancelled` tab is
 * CANCELLED ∪ DECLINED with no time filter, so future and past both appear;
 * each row's chip says which of the two it was.
 *
 * State lives on the component: one tab, one list, no segment to share —
 * a store would be ceremony.
 */
@Component({
  selector: 'mh-cancelled-bookings',
  imports: [
    EmptyState,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonItem,
    IonLabel,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    MySessionRow,
  ],
  templateUrl: './cancelled-bookings.html',
  styleUrl: './cancelled-bookings.scss',
})
export class CancelledBookings implements ViewWillEnter {
  private readonly _sessionService = inject(SessionService);
  private readonly _router = inject(Router);

  readonly skeletonRows = [1, 2, 3];

  readonly bookings = signal<SessionParticipant[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);

  private readonly _page = signal(1);
  private readonly _total = signal(0);

  constructor() {
    addIcons(MY_SESSION_ICONS);
  }

  ionViewWillEnter(): void {
    this._load();
  }

  hasMore(): boolean {
    return this.bookings().length < this._total();
  }

  open(booking: SessionParticipant): void {
    void this._router.navigate(['/tabs/user/sessions', booking.instanceId], {
      state: { participant: booking },
    });
  }

  onRefresh(event: RefresherCustomEvent): void {
    this._load(() => void event.target.complete());
  }

  onMore(event: InfiniteScrollCustomEvent): void {
    const done = () => void event.target.complete();
    if (this.loading() || !this.hasMore()) {
      done();
      return;
    }
    const next = this._page() + 1;
    this.loading.set(true);
    this._sessionService
      .listMy({ tab: MyTab.Cancelled, page: next, limit: PAGE_SIZE })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.bookings.update((items) => [...items, ...page.items]);
          this._total.set(page.total);
          this._page.set(next);
          this.loading.set(false);
          done();
        },
        error: () => {
          this.loading.set(false);
          done();
        },
      });
  }

  retry(): void {
    this._load();
  }

  private _load(done?: () => void): void {
    if (this.loading()) {
      done?.();
      return;
    }
    this.loading.set(true);
    this.error.set(false);

    this._sessionService
      .listMy({ tab: MyTab.Cancelled, page: 1, limit: PAGE_SIZE })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.bookings.set(page.items);
          this._total.set(page.total);
          this._page.set(1);
          this.loading.set(false);
          done?.();
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
          done?.();
        },
      });
  }
}
