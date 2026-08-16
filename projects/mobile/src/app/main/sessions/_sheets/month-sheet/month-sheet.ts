import { Component, computed, effect, input, model, output, signal } from '@angular/core';
import { IonButton, IonIcon, IonNote } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { SessionInstance, localDayKey } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { SESSION_ICONS, WEEKDAY_LETTERS, instanceTone } from '../../sessions.config';

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
  imports: [IonButton, IonIcon, IonNote, SheetShell],
  templateUrl: './month-sheet.html',
  styleUrl: './month-sheet.scss',
})
export class MonthSheet {
  readonly open = model(false);
  readonly instances = input.required<SessionInstance[]>();
  /** Which month the agenda is currently anchored on. */
  readonly anchor = input<Date>(new Date());

  readonly daySelected = output<Date>();
  /** Asks the page to load a window covering this month. */
  readonly monthChanged = output<Date>();

  readonly weekdayLabels = WEEKDAY_LETTERS;

  /** First of the month being shown. */
  readonly cursor = signal(startOfMonth(new Date()));

  constructor() {
    addIcons(SESSION_ICONS);

    effect(() => {
      if (!this.open()) return;
      this.cursor.set(startOfMonth(this.anchor()));
    });
  }

  readonly monthLabel = computed(() =>
    this.cursor().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
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

  pick(cell: MonthCell): void {
    const [year, month, day] = cell.key.split('-').map(Number);
    this.daySelected.emit(new Date(year, month - 1, day));
    this.open.set(false);
  }
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
