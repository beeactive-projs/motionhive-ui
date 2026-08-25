import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import { SessionParticipant, SessionService, localDayKey, sessionDayLabel } from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { NotificationBell } from '../../../../_shared/components/notification-bell/notification-bell';
import { ClockService } from '../../../../_shared/services/clock.service';
import { MySessionRow } from '../_components/my-session-row/my-session-row';
import { MySessionsEmpty } from '../_components/my-sessions-empty/my-sessions-empty';
import { MY_SESSION_ICONS, bookingLifecycle } from '../my-sessions.config';
import { MySessionsStore } from './my-sessions.store';

interface BookingDay {
  key: string;
  label: string;
  isToday: boolean;
  bookings: SessionParticipant[];
}

/**
 * The trainee's sessions list: Upcoming (booked + awaiting approval +
 * waitlisted, folded into one segment) and Past (a record — attendance
 * marks, no ratings). Cancelled & declined hide behind a ghost row at the
 * end of both segments.
 *
 * The coach twin at `/tabs/coach/sessions` answers "what am I running";
 * this list answers "do I have a seat".
 */
@Component({
  selector: 'mh-my-sessions',
  imports: [
    EmptyState,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonItem,
    IonLabel,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    MySessionRow,
    MySessionsEmpty,
    NotificationBell,
  ],
  templateUrl: './my-sessions.html',
  styleUrl: './my-sessions.scss',
  providers: [MySessionsStore],
})
export class MySessions implements ViewWillEnter {
  readonly store = inject(MySessionsStore);
  private readonly _router = inject(Router);
  private readonly _clockService = inject(ClockService);
  private readonly _sessionService = inject(SessionService);

  readonly skeletonRows = [1, 2, 3, 4, 5];

  /**
   * The store's upcoming list re-read against the pulled clock: a lifted
   * live session decays out of Upcoming the moment it ends, without a
   * refetch. Past symmetrically hides anything still running.
   */
  private readonly _upcomingDisplay = computed(() => {
    const now = this._clockService.now();
    return this.store
      .upcoming()
      .filter((booking) => bookingLifecycle(booking, now) !== 'past');
  });

  private readonly _pastDisplay = computed(() => {
    const now = this._clockService.now();
    return this.store
      .past()
      .filter((booking) => bookingLifecycle(booking, now) === 'past');
  });

  readonly isUpcoming = computed(() => this.store.segment() === 'upcoming');

  readonly days = computed<BookingDay[]>(() => {
    const upcoming = this.isUpcoming();
    const bookings = upcoming ? this._upcomingDisplay() : this._pastDisplay();
    const byDay = new Map<string, SessionParticipant[]>();

    for (const booking of bookings) {
      const startAt = booking.instance?.startAt;
      if (!startAt) continue;
      const key = localDayKey(new Date(startAt));
      const bucket = byDay.get(key);
      if (bucket) bucket.push(booking);
      else byDay.set(key, [booking]);
    }

    const todayKey = localDayKey(new Date());
    return [...byDay.entries()]
      .sort(([a], [b]) => (upcoming ? a.localeCompare(b) : b.localeCompare(a)))
      .map(([key, items]) => ({
        key,
        label: sessionDayLabel(new Date(items[0].instance!.startAt)),
        isToday: key === todayKey,
        bookings: items,
      }));
  });

  readonly loading = computed(() =>
    this.isUpcoming() ? this.store.upcomingLoading() : this.store.pastLoading(),
  );

  readonly loadError = computed(() =>
    this.isUpcoming() ? this.store.upcomingError() : this.store.pastError(),
  );

  readonly showSkeleton = computed(() => this.loading() && this.days().length === 0);

  readonly showLoadError = computed(() => this.loadError() && this.days().length === 0);

  readonly isEmpty = computed(
    () => !this.loading() && !this.loadError() && this.days().length === 0,
  );

  /** "Upcoming · 4" once the counts land; a bare "Upcoming" until then. */
  readonly upcomingLabel = computed(() => {
    const count = this.store.upcomingCount();
    return count === null ? 'Upcoming' : `Upcoming · ${count}`;
  });

  constructor() {
    addIcons(MY_SESSION_ICONS);
  }

  // Not ngOnInit: Ionic keeps the page alive in the tab stack. A booking or
  // a cancel elsewhere changes this list, so entering always refetches.
  ionViewWillEnter(): void {
    this._clockService.bump();
    this.store.loadCounts();
    if (this.isUpcoming()) this.store.loadUpcoming({ force: true });
    else this.store.loadPast({ force: true });
  }

  setSegment(value: string | number | undefined): void {
    if (value !== 'upcoming' && value !== 'past') return;
    this.store.segment.set(value);
    if (value === 'past') this.store.loadPast();
    else this.store.loadUpcoming();
  }

  open(booking: SessionParticipant): void {
    void this._router.navigate(['/tabs/user/sessions', booking.instanceId], {
      state: { participant: booking },
    });
  }

  /**
   * The live row's Join pill — straight into the meeting, skipping the
   * detail screen. `listMy` strips the snapshot meeting URL, so the link
   * comes from `joinInfo`; if that refuses (window closed a moment ago,
   * connection gone), the detail screen explains instead.
   */
  join(booking: SessionParticipant): void {
    this._sessionService
      .joinInfo(booking.instanceId)
      .pipe(take(1))
      .subscribe({
        next: (info) => window.open(info.meetingUrl, '_blank', 'noopener'),
        error: () => this.open(booking),
      });
  }

  openCancelled(): void {
    void this._router.navigate(['/tabs/user/sessions/cancelled']);
  }

  openDiscover(): void {
    void this._router.navigateByUrl('/tabs/discover');
  }

  onRefresh(event: RefresherCustomEvent): void {
    this._clockService.bump();
    this.store.refresh(() => void event.target.complete());
  }

  onMorePast(event: InfiniteScrollCustomEvent): void {
    this.store.loadMorePast(() => void event.target.complete());
  }

  retry(): void {
    this.store.refresh();
  }
}
