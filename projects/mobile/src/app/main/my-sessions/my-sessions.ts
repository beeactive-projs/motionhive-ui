import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  InfiniteScrollCustomEvent,
  RefresherCustomEvent,
  SegmentCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { forkJoin, take } from 'rxjs';

import {
  MyCounts,
  SessionParticipant,
  SessionService,
  dayDividerLabel,
  localDayKey,
} from 'core';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { SESSION_ICONS } from '../sessions/sessions.config';
import { BookingRow } from './_components/booking-row/booking-row';
import {
  BOOKING_TABS,
  BookingTab,
  MY_SESSION_ICONS,
  TAB_SOURCES,
} from './my-sessions.config';

const PAGE_SIZE = 20;

/**
 * Upcoming merges three API buckets, and paging across merged sources would
 * interleave three independent cursors. It asks for this many of each instead
 * — a trainee with more than fifty future bookings is not a case worth the
 * complexity, and `hasMore` stays honest if one ever appears.
 */
const MERGED_LIMIT = 50;

/**
 * The trainee's sessions: what they have booked, what they are waiting on, and
 * what they have already done.
 *
 * The coach's agenda and this list are the same data seen from opposite sides,
 * but they are separate screens on purpose. A coach asks "what is my day", so
 * that one is a calendar. A trainee asks "what have I got coming up", so this
 * one is a list of their own bookings — `GET /sessions/my` returns
 * participations, not occurrences, which is the distinction.
 *
 * No store: this is one endpoint with a tab and a page number, and the state
 * dies with the screen. `SessionsInstructorStore` exists because the agenda
 * caches windows across a calendar; there is nothing to cache here.
 */
@Component({
  selector: 'mh-my-sessions',
  imports: [
    BookingRow,
    EmptyState,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonItem,
    IonLabel,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    NotificationBell,
  ],
  templateUrl: './my-sessions.html',
  styleUrl: './my-sessions.scss',
})
export class MySessions implements ViewWillEnter {
  private readonly _sessionService = inject(SessionService);
  private readonly _router = inject(Router);

  readonly tabs = BOOKING_TABS;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  /** 'cancelled' is reachable from the footer row, not the segment. */
  readonly tab = signal<BookingTab | 'cancelled'>('upcoming');
  readonly bookings = signal<SessionParticipant[]>([]);
  readonly counts = signal<MyCounts | null>(null);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly total = signal(0);

  private readonly _page = signal(1);

  readonly hasMore = computed(
    () => TAB_SOURCES[this.tab()].length === 1 && this.bookings().length < this.total(),
  );

  /** First load only. A tab switch keeps the old rows until the new land. */
  readonly showSkeleton = computed(() => this.loading() && this.bookings().length === 0);

  readonly showLoadError = computed(() => this.loadFailed() && this.bookings().length === 0);

  readonly isEmpty = computed(
    () => !this.loading() && !this.loadFailed() && this.bookings().length === 0,
  );

  /**
   * Bookings under a day pill — the same grouping the chat and the
   * notification centre use, so a date means one thing across the app.
   */
  readonly days = computed(() => {
    const buckets = new Map<string, SessionParticipant[]>();
    for (const booking of this.bookings()) {
      const startAt = booking.instance?.startAt;
      if (!startAt) continue;
      const key = localDayKey(new Date(startAt));
      const bucket = buckets.get(key);
      if (bucket) bucket.push(booking);
      else buckets.set(key, [booking]);
    }
    return [...buckets].map(([key, items]) => ({
      key,
      label: dayDividerLabel(key),
      items,
    }));
  });

  readonly cancelledCount = computed(() => this.countFor('cancelled'));

  readonly showCancelledRow = computed(
    () => this.tab() !== 'cancelled' && this.cancelledCount() > 0,
  );

  /** Per-tab copy: "nothing booked" and "nothing cancelled" are not the same. */
  readonly emptyCopy = computed(() => {
    switch (this.tab()) {
      case 'upcoming':
        return {
          heading: 'Nothing booked yet',
          message: 'Sessions you book will show up here.',
          action: 'Find a session',
        };
      case 'past':
        return {
          heading: 'No sessions yet',
          message: 'Once you have trained, your history lives here.',
          action: null,
        };
      default:
        return {
          heading: 'Nothing cancelled',
          message: 'Bookings you or your coach called off appear here.',
          action: null,
        };
    }
  });

  constructor() {
    addIcons({ ...SESSION_ICONS, ...MY_SESSION_ICONS });
  }

  // Not ngOnInit: Ionic keeps the page in its tab stack, so bookings made
  // elsewhere would never show up on a return visit.
  ionViewWillEnter(): void {
    this._load();
    this._loadCounts();
  }

  /** A merged tab's badge is the sum of the buckets behind it. */
  countFor(tab: BookingTab | 'cancelled'): number {
    const counts = this.counts();
    if (!counts) return 0;
    return TAB_SOURCES[tab].reduce(
      (sum, source) => sum + (counts[source as keyof typeof counts] ?? 0),
      0,
    );
  }

  onTabChange(event: SegmentCustomEvent): void {
    const value = event.detail.value;
    if (typeof value !== 'string' || value === this.tab()) return;
    this.tab.set(value as BookingTab);
    this.bookings.set([]);
    this._load();
  }

  /**
   * The Join chip goes through the session page rather than fetching the link
   * here: that screen already owns the join call, its error copy and the
   * window check, and duplicating it would give two places to keep right.
   */
  join(booking: SessionParticipant): void {
    if (booking.instanceId) {
      void this._router.navigate(['/tabs/sessions', booking.instanceId], {
        queryParams: { join: 1 },
      });
    }
  }

  open(booking: SessionParticipant): void {
    const instanceId = booking.instanceId;
    if (instanceId) void this._router.navigate(['/tabs/sessions', instanceId]);
  }

  discover(): void {
    void this._router.navigate(['/tabs/discover']);
  }

  showCancelled(): void {
    this.tab.set('cancelled');
    this.bookings.set([]);
    this._load();
  }

  backToUpcoming(): void {
    this.tab.set('upcoming');
    this.bookings.set([]);
    this._load();
  }

  retry(): void {
    this._load();
  }

  onRefresh(event: RefresherCustomEvent): void {
    this._loadCounts();
    this._load({ done: () => void event.target.complete() });
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    if (this.loading() || !this.hasMore()) {
      void event.target.complete();
      return;
    }
    this._page.update((page) => page + 1);
    this._load({ append: true, done: () => void event.target.complete() });
  }

  private _load(opts: { append?: boolean; done?: () => void } = {}): void {
    if (!opts.append) this._page.set(1);
    this.loading.set(true);
    this.loadFailed.set(false);

    const sources = TAB_SOURCES[this.tab()];
    const requests = sources.map((source) =>
      this._sessionService.listMy(
        sources.length > 1
          ? { tab: source, page: 1, limit: MERGED_LIMIT }
          : { tab: source, page: this._page(), limit: PAGE_SIZE },
      ),
    );

    forkJoin(requests)
      .pipe(take(1))
      .subscribe({
        next: (responses) => {
          const items = responses.flatMap((response) => response.items);
          // Merged buckets arrive in three separate orders; soonest first is
          // the only order that answers "what is next".
          if (sources.length > 1) {
            items.sort(
              (a, b) =>
                new Date(a.instance?.startAt ?? 0).getTime() -
                new Date(b.instance?.startAt ?? 0).getTime(),
            );
          }
          this.bookings.update((current) =>
            opts.append ? [...current, ...items] : items,
          );
          this.total.set(responses.reduce((sum, response) => sum + response.total, 0));
          this.loading.set(false);
          opts.done?.();
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
          opts.done?.();
        },
      });
  }

  private _loadCounts(): void {
    this._sessionService
      .myCounts()
      .pipe(take(1))
      .subscribe({ next: (counts) => this.counts.set(counts) });
  }
}
