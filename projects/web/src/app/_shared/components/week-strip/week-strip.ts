import {
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { appLocale, weekdayNames } from 'core';

/**
 * `mh-week-strip` — 7-column horizontal day picker used in the mobile
 * calendar's Agenda view (design frame 2A).
 *
 * Each cell shows: single-letter weekday label · day-of-month number ·
 * up to 4 dots colored by session-tone density.
 *
 * Inputs:
 *   - `weekStart` — required, Date anchored to the Monday of the
 *      week to render. Component derives the 7 cells.
 *   - `selectedDate` — the day painted with the primary background.
 *      Two-way bindable; defaults to null (no selection).
 *   - `dotsByDate` — map keyed by ISO date (YYYY-MM-DD) → array of
 *      WeekStripDot. The strip renders up to 4 dots per day; extras
 *      get summarised with a "+N" indicator (out of scope first cut —
 *      just truncates).
 *
 * Mobile-first: the strip stays 7-up at every viewport because it's
 * the design's primary nav surface on phones. Wraps fine at the
 * tablet break too.
 */

export type WeekStripTone = 'honey' | 'teal' | 'navy' | 'coral';

export interface WeekStripDot {
  /** Tone — usually maps to session location/type. */
  tone: WeekStripTone;
}

@Component({
  selector: 'mh-week-strip',
  imports: [TranslatePipe],
  templateUrl: './week-strip.html',
  styleUrl: './week-strip.scss',
})
export class WeekStrip {
  /** Monday of the rendered week. */
  readonly weekStart = input.required<Date>();
  readonly selectedDate = input<Date | null>(null);
  /** Map of YYYY-MM-DD → dots for that day. */
  readonly dotsByDate = input<Record<string, WeekStripDot[]>>({});

  /** Emits the tapped day. Parent updates its anchor + reloads. */
  readonly selectedDateChange = output<Date>();

  /** Single-letter weekday labels in the UI locale, Monday first. */
  private readonly _weekdayLabels = weekdayNames('narrow');

  /** Derived 7-cell array — labels, day numbers, dots, flags. */
  protected readonly cells = computed(() => {
    const start = this.weekStart();
    const selected = this.selectedDate();
    const dots = this.dotsByDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selKey = selected ? toISODateLocal(selected) : null;

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const iso = toISODateLocal(d);
      const dayDots = (dots[iso] ?? []).slice(0, 4);
      const hasConflict = dayDots.some((dot) => dot.tone === 'coral');
      return {
        date: d,
        iso,
        // JS getDay() is Sun=0; the label list is Mon-first.
        label: this._weekdayLabels[(d.getDay() + 6) % 7],
        day: d.getDate(),
        isToday: d.getTime() === today.getTime(),
        isSelected: selKey === iso,
        hasConflict,
        dots: dayDots,
        aria: d.toLocaleDateString(appLocale(), {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
      };
    });
  });

  protected onSelect(d: Date): void {
    this.selectedDateChange.emit(d);
  }
}

/**
 * Local-zone YYYY-MM-DD. Avoid `toISOString().slice(0,10)` because that
 * shifts the date when local zone is east of UTC (e.g. user in +03:00,
 * 00:30 local → "yesterday" via UTC date).
 */
function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
