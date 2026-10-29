import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonIcon, IonNote } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { WorkoutLog } from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { SessionRowSkeleton } from '../../../../_shared/components/session-row-skeleton/session-row-skeleton';
import { HistoryFilter, HistoryFilters, HistoryStore } from '../../history/history.store';
import { logMonths, logWeeks, shortDayLabel } from '../../workouts.config';
import { HistoryCalendar } from '../history-calendar/history-calendar';
import { LogRow } from '../log-row/log-row';
import { MemoryCard } from '../memory-card/memory-card';
import { PhotoTile } from '../photo-tile/photo-tile';

/**
 * The Workouts page's History tab: everything logged, newest first, a card
 * per week, under the chips that narrow it to the workouts with a record or
 * a photo (a grid of those). The calendar stays out of the way behind the
 * button at the end of the chips; a day tapped on it narrows the list to
 * that day. Above the list, a memory when one is true: a workout from a
 * while back next to how far one of its lifts has come since.
 *
 * Skipped plan days stay in the list rather than disappearing — a skip was a
 * decision, and a history that hides them reads as a cleaner record than the
 * one that actually happened. Repeat is first-class on every done row: it is
 * the fastest route to a second workout.
 *
 * Its state is the host page's `HistoryStore`, so switching tabs keeps the
 * place; the host refreshes it when the tab shows and registers its icons
 * (`WORKOUT_ICONS`). A page at a time, with Show more under the list.
 */
@Component({
  selector: 'mh-history-body',
  imports: [
    EmptyState,
    HistoryCalendar,
    IonButton,
    IonIcon,
    IonNote,
    LogRow,
    MemoryCard,
    PhotoTile,
    SessionRowSkeleton,
    TranslatePipe,
  ],
  templateUrl: './history-body.html',
  styleUrl: './history-body.scss',
})
export class HistoryBody {
  readonly store = inject(HistoryStore);
  private readonly _router = inject(Router);

  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly Filters = HistoryFilters;

  /** The design's order: everything, then what you beat, then what you kept. */
  readonly filters: readonly { id: HistoryFilter; label: string }[] = [
    { id: HistoryFilters.All, label: 'workouts.history.filters.all' },
    { id: HistoryFilters.Records, label: 'workouts.history.filters.record' },
    { id: HistoryFilters.Photos, label: 'workouts.history.filters.photo' },
  ];

  /** The photo filter's grid, by the month each workout was done. */
  readonly photoMonths = computed(() => logMonths(this.store.items()));

  /** The list as a card per week: "Week of 26 Oct". */
  readonly weeks = computed(() => logWeeks(this.store.items()));

  /** "Wed 23 Oct", the day the list is narrowed to. */
  readonly dayLabel = computed(() => {
    const day = this.store.day();
    return day ? shortDayLabel(day) : '';
  });

  retry(): void {
    this.store.refresh();
  }

  /** A skipped plan day has no log behind it; the row does not offer to open. */
  open(log: WorkoutLog): void {
    this._openLog(log.id);
  }

  /** The memory's workout, by id: it is rarely on the loaded page. */
  openId(id: string): void {
    this._openLog(id);
  }

  /** A tapped calendar day narrows the list below to it. */
  onDaySelect(key: string): void {
    this.store.setDay(key);
  }

  clearDay(): void {
    this.store.setDay(null);
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
