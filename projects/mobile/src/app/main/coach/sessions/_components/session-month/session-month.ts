import { Component, computed, input, model, output } from '@angular/core';
import { IonButton, IonCard, IonCardContent, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';

import { SessionInstance, appLocale, dayFromKey, localDayKey, startOfMonth, translate } from 'core';

import { MONTH_LEGEND, instanceTone, weekdayLetters } from '../../sessions.config';

interface MonthCell {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  dots: string[];
  /** "Thursday, 29 October, 2 sessions": what a screen reader says for it. */
  label: string;
}

/**
 * A month of sessions, inline: a dot per session on its day (up to three,
 * keyed to the type, coral for a clash), the past and the future alike.
 * Shown behind the calendar button beside a sessions list's chips (the
 * coach's agenda, a client's Sessions tab), the same pattern as History's
 * calendar.
 *
 * Presentational: the page owns the month and its sessions, and decides
 * what a tapped day does.
 */
@Component({
  selector: 'mh-session-month',
  imports: [IonButton, IonCard, IonCardContent, IonIcon, TranslatePipe],
  templateUrl: './session-month.html',
  styleUrl: './session-month.scss',
})
export class SessionMonth {
  readonly instances = input.required<SessionInstance[]>();
  /** First of the month shown. */
  readonly month = input.required<Date>();
  /** The day last tapped, as `yyyy-mm-dd`; bindable, so a page can clear it. */
  readonly selected = model<string | null>(null);

  readonly monthChange = output<Date>();
  readonly daySelect = output<Date>();

  /** Monday-first single letters in the UI locale. */
  readonly weekdayLabels = weekdayLetters();
  readonly legend = MONTH_LEGEND;

  readonly monthLabel = computed(() =>
    this.month().toLocaleDateString(appLocale(), { month: 'long', year: 'numeric' }),
  );

  readonly isCurrentMonth = computed(() => {
    const month = this.month();
    const now = new Date();
    return month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  });

  /** Each day's sessions, by tone; the cell draws at most three dots. */
  private readonly _tonesByDay = computed(() => {
    const map = new Map<string, string[]>();
    for (const instance of this.instances()) {
      const key = localDayKey(new Date(instance.startAt));
      map.set(key, [...(map.get(key) ?? []), instanceTone(instance)]);
    }
    return map;
  });

  readonly cells = computed<MonthCell[]>(() => {
    const first = startOfMonth(this.month());
    const todayKey = localDayKey(new Date());
    const tones = this._tonesByDay();
    // Monday-first, matching the week strip and the BE's ISO weekdays.
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    // Six rows always: a fixed height stops the card resizing between months.
    return Array.from({ length: 42 }, (_, offset) => {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      const key = localDayKey(date);
      const day = tones.get(key) ?? [];
      const name = date.toLocaleDateString(appLocale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      return {
        key,
        day: date.getDate(),
        inMonth: date.getMonth() === first.getMonth(),
        isToday: key === todayKey,
        dots: day.slice(0, 3),
        label: day.length ? `${name}, ${translate('count.sessions', { count: day.length })}` : name,
      };
    });
  });

  constructor() {
    // Its own glyphs: the card sits on pages that register others.
    addIcons({ chevronBackOutline, chevronForwardOutline });
  }

  step(months: number): void {
    const month = this.month();
    this.monthChange.emit(new Date(month.getFullYear(), month.getMonth() + months, 1));
  }

  /** Back to this month; a day is still yours to pick. */
  goToday(): void {
    this.monthChange.emit(startOfMonth(new Date()));
  }

  pick(cell: MonthCell): void {
    this.selected.set(cell.key);
    this.daySelect.emit(dayFromKey(cell.key));
  }
}
