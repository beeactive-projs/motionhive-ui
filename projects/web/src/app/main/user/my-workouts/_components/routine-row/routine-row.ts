import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { Routine } from 'core';

/**
 * Left-edge accent of a routine row — a single, honey-free axis
 * (honey is reserved for actions, see CLAUDE.md):
 *
 *   - `Active`   (teal)  — performed at least once (`lastPerformedAt` set).
 *   - `Inactive` (muted) — never started yet.
 */
const RoutineRowTone = {
  Active: 'active',
  Inactive: 'inactive',
} as const;
type RoutineRowTone = (typeof RoutineRowTone)[keyof typeof RoutineRowTone];

/**
 * `mh-routine-row` — a single saved-routine row in the my-workouts
 * "Routines" tab. Presentational: takes one `Routine` and emits
 * `start` / `edit` / `remove`; the page owns the service calls + dialogs.
 *
 * Layout mirrors `mh-my-plan-row` (one-per-row agenda): a left count block,
 * name + folder + last-performed meta, an optional notes line, and the
 * actions on the right (Start primary, edit/delete secondary). Unlike the
 * plan row it isn't a single-action button host — Start mutates (creates a
 * log), so it stays an explicit button to avoid accidental starts.
 */
@Component({
  selector: 'mh-routine-row',
  standalone: true,
  imports: [DatePipe, Button, Card, TooltipModule],
  templateUrl: './routine-row.html',
  styleUrl: './routine-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-tone]': 'tone()',
  },
})
export class RoutineRow {
  readonly routine = input.required<Routine>();
  /** Mobile viewport flag (from the page's `injectIsMobile()`). */
  readonly mobile = input<boolean>(false);
  /** Per-row spinner while this routine is being started. */
  readonly starting = input<boolean>(false);

  readonly start = output<void>();
  readonly edit = output<void>();
  readonly remove = output<void>();

  protected readonly exerciseCount = computed(() => this.routine().exercises?.length ?? 0);

  protected readonly notes = computed(() => this.routine().notes?.trim() || null);

  protected readonly tone = computed<RoutineRowTone>(() =>
    this.routine().lastPerformedAt ? RoutineRowTone.Active : RoutineRowTone.Inactive,
  );

  protected onStart(event?: MouseEvent): void {
    event?.stopPropagation();
    this.start.emit();
  }

  protected onEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.edit.emit();
  }

  protected onRemove(event: MouseEvent): void {
    event.stopPropagation();
    this.remove.emit();
  }
}
