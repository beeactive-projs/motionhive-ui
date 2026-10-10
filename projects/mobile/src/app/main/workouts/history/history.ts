import { Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { WorkoutLog, localDayKey } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { SessionRowSkeleton } from '../../../_shared/components/session-row-skeleton/session-row-skeleton';
import { HistoryCalendar } from '../_components/history-calendar/history-calendar';
import { LogRow } from '../_components/log-row/log-row';
import { WORKOUT_ICONS } from '../workouts.config';
import { HistoryStore } from './history.store';

/** Breathing room above a row the calendar scrolls to, in CSS pixels. */
const ROW_SCROLL_GAP = 12;

/**
 * Everything logged, newest first.
 *
 * Skipped days stay in the list rather than disappearing — a skip was a
 * decision, and a history that hides them reads as a cleaner training record
 * than the one that actually happened. Repeat is first-class on every done
 * row: it is the fastest route to a second workout.
 */
@Component({
  selector: 'mh-workout-history',
  imports: [
    EmptyState,
    HistoryCalendar,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    LogRow,
    SessionRowSkeleton,
    TranslatePipe,
  ],
  templateUrl: './history.html',
  styleUrl: './history.scss',
  providers: [HistoryStore],
})
export class History implements ViewWillEnter {
  readonly store = inject(HistoryStore);
  private readonly _router = inject(Router);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _content = viewChild(IonContent);

  readonly skeletonRows = [1, 2, 3, 4, 5];

  /** Each row's local day, the hook a calendar tap scrolls to. */
  readonly dayKeys = computed(
    () => new Map(this.store.items().map((log) => [log.id, localDayKey(new Date(log.startedAt))])),
  );

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  // Not ngOnInit: Ionic keeps the page alive in the stack, and a workout
  // finished since belongs at the top. The store re-reads the loaded window
  // in place, so the scroll holds.
  ionViewWillEnter(): void {
    this.store.refresh();
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.refresh(() => void event.target.complete());
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    this.store.loadMore(() => void event.target.complete());
  }

  retry(): void {
    this.store.refresh();
  }

  open(log: WorkoutLog): void {
    this._openLog(log.id);
  }

  /**
   * A tapped calendar day. One workout opens like its row would; several
   * scroll the list to that day so you can pick, or, when the day is further
   * back than the list has loaded, open the newest of them.
   */
  async onDaySelect(key: string): Promise<void> {
    const ids = this.store.calendarCells().find((cell) => cell.key === key)?.logIds ?? [];
    if (!ids.length) return;
    if (ids.length === 1) {
      this._openLog(ids[0]);
      return;
    }

    const row = this._elementRef.nativeElement.querySelector<HTMLElement>(`[data-day="${key}"]`);
    const content = this._content();
    if (!row || !content) {
      this._openLog(ids[0]);
      return;
    }

    const scroller = await content.getScrollElement();
    // The scroller's top padding is the header the page scrolls under; the
    // row lands just below it rather than behind it.
    const headerOffset = parseFloat(getComputedStyle(scroller).paddingTop) || 0;
    const y =
      row.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      headerOffset -
      ROW_SCROLL_GAP;
    await content.scrollToPoint(0, Math.max(0, y), 300);
  }

  private _openLog(id: string): void {
    void this._router.navigate(['/tabs/workouts/finish', id]);
  }

  /**
   * Do that one again.
   *
   * Starts a fresh freestyle workout carrying the same movements, rather
   * than re-opening the original or minting a routine on the way past: the
   * plan day this came from was scheduled for a date already gone, and a
   * routine per repeat would silently fill the library with near-duplicates.
   */
  repeat(log: WorkoutLog): void {
    void this._router.navigate(['/tabs/workouts/log', 'new'], {
      queryParams: { from: log.id },
    });
  }
}
