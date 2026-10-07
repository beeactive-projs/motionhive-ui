import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import {
  SessionInstance,
  appLocale,
  dayFromKey,
  localDayKey,
  startOfDay,
  startOfMonth,
} from 'core';

import { SheetShell } from '../../../../../_shared/components/sheet-shell/sheet-shell';
import { MONTH_LEGEND, SESSION_ICONS, instanceTone, weekdayLetters } from '../../sessions.config';

interface MonthCell {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  dots: string[];
}


/**
 * Month grid for jumping the agenda somewhere else.
 *
 * The dots come from whatever window is already loaded rather than fetching a
 * month — moving to a month outside it asks the page to widen the window, and
 * the dots fill in when that lands.
 */
@Component({
  selector: 'mh-month-sheet',
  imports: [IonButton, IonIcon, SheetShell, TranslatePipe],
  templateUrl: './month-sheet.html',
  styleUrl: './month-sheet.scss',
})
export class MonthSheet {
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly instances = input.required<SessionInstance[]>();
  /** Which month the agenda is currently anchored on. */
  readonly anchor = input<Date>(new Date());

  readonly daySelected = output<Date>();
  /** Asks the page to load a window covering this month. */
  readonly monthChanged = output<Date>();

  /** Monday-first single letters in the UI locale. */
  readonly weekdayLabels = weekdayLetters();
  readonly legend = MONTH_LEGEND;

  /** First of the month being shown. */
  readonly cursor = signal(startOfMonth(new Date()));

  /**
   * The day tapped, held until the CTA commits it.
   *
   * Staged rather than applied on tap: jumping the agenda the instant a finger
   * lands makes every mis-tap a navigation, and the sheet dismissing underneath
   * you gives no chance to correct it. The footer says exactly which day it is
   * about to jump to.
   */
  readonly staged = signal<Date | null>(null);

  constructor() {
    addIcons(SESSION_ICONS);

    effect(() => {
      if (!this.open()) return;
      this.cursor.set(startOfMonth(this.anchor()));
      this.staged.set(startOfDay(this.anchor()));
    });
  }

  readonly stagedKey = computed(() => {
    const staged = this.staged();
    return staged ? localDayKey(staged) : null;
  });

  readonly jumpLabel = computed(() => {
    const staged = this.staged();
    if (!staged) return this._translateService.instant('sessions.monthSheet.jump');
    const date = staged.toLocaleDateString(appLocale(), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return this._translateService.instant('sessions.monthSheet.jumpTo', { date });
  });

  readonly monthLabel = computed(() =>
    this.cursor().toLocaleDateString(appLocale(), { month: 'long', year: 'numeric' }),
  );

  /** Session dots per day, capped at three so a row cannot grow. */
  private readonly _dotsByDay = computed(() => {
    const map = new Map<string, string[]>();
    for (const instance of this.instances()) {
      const key = localDayKey(new Date(instance.startAt));
      const existing = map.get(key) ?? [];
      if (existing.length >= 3) continue;
      existing.push(instanceTone(instance));
      map.set(key, existing);
    }
    return map;
  });

  readonly cells = computed<MonthCell[]>(() => {
    const cursor = this.cursor();
    const todayKey = localDayKey(new Date());
    const dots = this._dotsByDay();

    const first = startOfMonth(cursor);
    // Monday-first, matching the week strip and the BE's ISO weekdays.
    const leading = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - leading);

    // Six rows always: a fixed height stops the sheet resizing between months.
    return Array.from({ length: 42 }, (_, offset) => {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      const key = localDayKey(date);
      return {
        key,
        day: date.getDate(),
        inMonth: date.getMonth() === cursor.getMonth(),
        isToday: key === todayKey,
        dots: dots.get(key) ?? [],
      };
    });
  });

  step(months: number): void {
    const next = startOfMonth(this.cursor());
    next.setMonth(next.getMonth() + months);
    this.cursor.set(next);
    this.monthChanged.emit(next);
  }

  /** Jump the grid back to the current month without committing a day. */
  goToday(): void {
    const today = startOfDay(new Date());
    this.cursor.set(startOfMonth(today));
    this.staged.set(today);
    this.monthChanged.emit(today);
  }

  pick(cell: MonthCell): void {
    this.staged.set(dayFromKey(cell.key));
  }

  /** The CTA is what actually moves the agenda. */
  jump(): void {
    const staged = this.staged();
    if (!staged) return;
    this.daySelected.emit(staged);
    this.open.set(false);
  }
}
