import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

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
 *      Defaults to today if omitted.
 *   - `dotsByDate` — map keyed by ISO date (YYYY-MM-DD) → array of
 *      WeekStripDot. The strip renders up to 4 dots per day; extras
 *      get summarised with a "+N" indicator (out of scope first cut —
 *      just truncates).
 *
 * Output:
 *   - `selectedDateChange` — emits the date object when the user
 *      taps a cell. Parent should update its anchor + reload.
 *
 * Mobile-first: the strip stays 7-up at every viewport because it's
 * the design's primary nav surface on phones. Wraps fine at the
 * tablet break too. Pass `[force]="true"` to override the mobile
 * styling if you ever drop it into a desktop column.
 */

export type WeekStripTone = 'honey' | 'teal' | 'navy' | 'coral';

export interface WeekStripDot {
  /** Tone — usually maps to session location/type. */
  tone: WeekStripTone;
}

@Component({
  selector: 'mh-week-strip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mh-ws" role="group" aria-label="Week navigator">
      @for (cell of cells(); track cell.iso) {
        <button
          type="button"
          class="mh-ws__cell"
          [class.is-today]="cell.isToday"
          [class.is-selected]="cell.isSelected"
          [class.has-conflict]="cell.hasConflict"
          [attr.aria-pressed]="cell.isSelected"
          [attr.aria-label]="cell.aria"
          (click)="onSelect(cell.date)"
        >
          <span class="mh-ws__label">{{ cell.label }}</span>
          <span class="mh-ws__day">{{ cell.day }}</span>
          @if (cell.dots.length > 0) {
            <span class="mh-ws__dots">
              @for (dot of cell.dots; track $index) {
                <span
                  class="mh-ws__dot"
                  [class.mh-ws__dot--honey]="dot.tone === 'honey'"
                  [class.mh-ws__dot--teal]="dot.tone === 'teal'"
                  [class.mh-ws__dot--navy]="dot.tone === 'navy'"
                  [class.mh-ws__dot--coral]="dot.tone === 'coral'"
                ></span>
              }
            </span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .mh-ws {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
      padding: 6px 4px 10px;
    }
    .mh-ws__cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 6px 0 8px;
      background: transparent;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-family: inherit;
      color: var(--p-text-color);
      transition: background 120ms ease, color 120ms ease;
      min-height: 56px;
      position: relative;
    }
    .mh-ws__cell:hover:not(.is-selected) {
      background: var(--p-surface-100);
    }
    .mh-ws__cell.is-today {
      background: var(--p-primary-500);
      color: var(--p-primary-contrast-color, #fff);
    }
    /* Selected wins over today's accent — the user explicitly picked
       this day, so the primary tint should follow the selection. */
    .mh-ws__cell.is-selected {
      background: var(--p-primary-50);
      color: var(--p-primary-700);
      box-shadow: 0 0 0 1.5px var(--p-primary-500);
    }
    .mh-ws__cell.is-today.is-selected {
      background: var(--p-primary-500);
      color: var(--p-primary-contrast-color, #fff);
    }
    .mh-ws__label {
      font-size: 10px;
      font-weight: 600;
      opacity: 0.85;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .mh-ws__day {
      font-family: 'Poppins', sans-serif;
      font-size: 16px;
      font-weight: 600;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .mh-ws__dots {
      display: flex;
      gap: 2px;
      min-height: 4px;
    }
    .mh-ws__dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--p-text-muted-color);
      opacity: 0.85;
    }
    .mh-ws__dot--honey { background: var(--p-primary-500); }
    .mh-ws__dot--teal  { background: var(--p-teal-500, #14B8A6); }
    .mh-ws__dot--navy  { background: var(--p-blue-700, #1D4ED8); }
    .mh-ws__dot--coral { background: var(--p-red-500, #F97066); }
    /* When the cell is on the primary background, force dots white so
       they stay visible. Otherwise the honey dot blends into the honey
       background and disappears. */
    .mh-ws__cell.is-today .mh-ws__dot,
    .mh-ws__cell.is-today.is-selected .mh-ws__dot {
      background: #fff;
    }
  `,
})
export class WeekStrip {
  /** Monday of the rendered week. */
  readonly weekStart = input.required<Date>();
  readonly selectedDate = input<Date | null>(null);
  /** Map of YYYY-MM-DD → dots for that day. */
  readonly dotsByDate = input<Record<string, WeekStripDot[]>>({});

  readonly selectedDateChange = output<Date>();

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
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }).charAt(0),
        day: d.getDate(),
        isToday: d.getTime() === today.getTime(),
        isSelected: selKey === iso,
        hasConflict,
        dots: dayDots,
        aria: d.toLocaleDateString('en-GB', {
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
