import { Component, computed, inject, input, model, output } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonNote,
  IonSkeletonText,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronDownOutline,
  chevronForwardOutline,
  chevronUpOutline,
} from 'ionicons/icons';

import { appLocale, dayFromKey, localDayKey, weekdayNames } from 'core';

import {
  CalendarCell,
  CalendarDayState,
  CalendarDayStates,
  calendarWeek,
} from '../../workouts.config';

interface CalendarDay {
  cell: CalendarCell;
  /** "Thursday 12 September: coach plan done". */
  label: string;
  /** Only a day with something logged opens anything. */
  tappable: boolean;
}

/** What the colours mean. Without it the grid is a colour chart with no key. */
const LEGEND: readonly { state: CalendarDayState; label: string }[] = [
  { state: CalendarDayStates.Coach, label: 'workouts.history.calendar.legendCoach' },
  { state: CalendarDayStates.Self, label: 'workouts.history.calendar.legendSelf' },
  { state: CalendarDayStates.Skipped, label: 'workouts.history.calendar.legendSkipped' },
];

/**
 * The training month on top of History: which days were trained, whose plan
 * they followed, and which were skipped. The same grid as the sessions month
 * sheet, so the two calendars in the app read as one.
 *
 * Presentational. The page owns the data and decides what a tapped day opens.
 */
@Component({
  selector: 'mh-history-calendar',
  imports: [IonButton, IonCard, IonCardContent, IonIcon, IonNote, IonSkeletonText, TranslatePipe],
  templateUrl: './history-calendar.html',
  styleUrl: './history-calendar.scss',
})
export class HistoryCalendar {
  private readonly _translateService = inject(TranslateService);

  readonly cells = input.required<CalendarCell[]>();
  /** First of the month shown. */
  readonly month = input.required<Date>();
  readonly doneCount = input.required<number>();
  /** Folded down to a single week. */
  readonly collapsed = model(false);
  readonly loading = input(false);
  readonly error = input(false);

  readonly monthChange = output<Date>();
  /** A day with logs was tapped, as its `yyyy-mm-dd` key. */
  readonly daySelect = output<string>();
  readonly retry = output<void>();

  /**
   * The legend's word for a workout of the person's own: "My workout" on
   * their History, the client's on a coach's page.
   */
  readonly selfLabel = input('workouts.history.calendar.legendSelf');

  readonly legend = computed(() =>
    LEGEND.map((entry) =>
      entry.state === CalendarDayStates.Self ? { ...entry, label: this.selfLabel() } : entry,
    ),
  );
  /** Monday-first single letters in the UI locale. */
  readonly weekdayLabels = weekdayNames('narrow');

  /**
   * The day last tapped; the honey fill follows it, today keeps the ring.
   * Bindable, so a page that filters by the day can clear it.
   */
  readonly selected = model<string | null>(null);
  readonly selectedKey = this.selected.asReadonly();

  readonly monthLabel = computed(() =>
    this.month().toLocaleDateString(appLocale(), { month: 'long', year: 'numeric' }),
  );

  /** History has no future: next stops at the current month. */
  readonly isCurrentMonth = computed(() => {
    const month = this.month();
    const now = new Date();
    return month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  });

  readonly days = computed<CalendarDay[]>(() => {
    const cells = this.collapsed()
      ? calendarWeek(this.cells(), this.selected() ?? localDayKey(new Date()))
      : this.cells();
    return cells.map((cell) => ({
      cell,
      label: this._dayLabel(cell),
      tappable: cell.logIds.length > 0,
    }));
  });

  readonly skeletonDays = computed(() => Array.from({ length: this.collapsed() ? 7 : 42 }));

  constructor() {
    // Its own glyphs: the calendar sits on pages that register others.
    addIcons({ chevronBackOutline, chevronDownOutline, chevronForwardOutline, chevronUpOutline });
  }

  step(months: number): void {
    if (months > 0 && this.isCurrentMonth()) return;
    const month = this.month();
    this.selected.set(null);
    this.monthChange.emit(new Date(month.getFullYear(), month.getMonth() + months, 1));
  }

  toggle(): void {
    this.collapsed.set(!this.collapsed());
  }

  pick(cell: CalendarCell): void {
    if (!cell.logIds.length) return;
    this.selected.set(cell.key);
    this.daySelect.emit(cell.key);
  }

  private _dayLabel(cell: CalendarCell): string {
    const date = dayFromKey(cell.key).toLocaleDateString(appLocale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const state =
      cell.state === CalendarDayStates.Future || !cell.inMonth ? CalendarDayStates.None : cell.state;
    return this._translateService.instant('workouts.history.calendar.dayLabel', {
      date,
      state: this._translateService.instant(`workouts.history.calendar.state.${state}`),
    });
  }
}
