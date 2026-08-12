import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import {
  LoggedExercise,
  LoggedSet,
  WorkoutLog,
  formatSessionDayShort,
  formatSessionTime,
} from 'core';

/**
 * Left-edge accent of a workout history row, on a single axis — *"did I set
 * a personal record?"*:
 *
 *   - `Pr`      (teal)  — one or more PRs broken this session.
 *   - `Default` (honey) — a normal logged session.
 *
 * The colour for each name lives in one place (`workout-row.scss`, keyed off
 * `[data-tone]`), mirroring `mh-my-session-row` / `mh-discover-session-row`.
 */
const WorkoutRowTone = {
  Pr: 'pr',
  Default: 'default',
} as const;
type WorkoutRowTone = (typeof WorkoutRowTone)[keyof typeof WorkoutRowTone];

/**
 * `mh-workout-row` — a single completed-workout row on the client
 * "Workouts" history. The workouts-side sibling of `mh-my-session-row`:
 * the same card layout (left tone stripe, prominent time, title + meta),
 * keyed off a `WorkoutLog`. Presentational — it derives its display data
 * from the log and emits `open`; the page owns the Router.
 *
 * The prominent slot is the clock time; a compact date sits above it only
 * inside multi-day buckets (`showDate`), exactly like the session rows.
 */
@Component({
  selector: 'mh-workout-row',
  standalone: true,
  imports: [Card, Tag],
  templateUrl: './workout-row.html',
  styleUrl: './workout-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'button',
    tabindex: '0',
    '[attr.data-tone]': 'tone()',
    '(click)': 'onOpen()',
    '(keydown)': 'onKey($event)',
  },
})
export class WorkoutRow {
  readonly log = input.required<WorkoutLog>();
  /** Mobile viewport flag (from the page's `injectIsMobile()`). */
  readonly mobile = input<boolean>(false);
  /** Show the row's date (multi-day buckets like "Earlier this week" / a month). */
  readonly showDate = input<boolean>(false);

  readonly open = output<void>();

  private readonly _feelingGlyphs = ['😣', '😕', '😐', '🙂', '💪'];

  // ─── Derived row data (all typed off WorkoutLog) ───────────────────────

  protected readonly title = computed(() => this.log().name);

  protected readonly start = computed(() => this.log().startedAt);

  /** Row time label (e.g. "12:39"). */
  protected readonly time = computed(() => formatSessionTime(this.start()));

  /** Compact date label (e.g. "Tue 16 Jun") for multi-day buckets. */
  protected readonly dateLabel = computed(() => formatSessionDayShort(this.start()));

  /** "45 min" — empty when the duration is unknown. */
  protected readonly durationLabel = computed(() => {
    const s = this.log().durationSeconds;
    return s != null ? `${Math.round(s / 60)} min` : '';
  });

  /**
   * Where this session came from. Three real answers, not two:
   * a coach's plan, one of your routines, or nothing at all. Routine
   * sessions used to read "Freestyle workout" because the log stored
   * no link back to the routine that produced them.
   */
  protected readonly provenance = computed<{
    label: string;
    kind: 'plan' | 'routine' | 'freestyle';
    targetId: string | null;
  }>(() => {
    const log = this.log();
    const plan = log.assignment?.programNameSnapshot;
    if (plan) {
      return { label: plan, kind: 'plan', targetId: log.programAssignmentId ?? null };
    }
    const routine = log.sourceProgram;
    if (routine) {
      return { label: routine.name, kind: 'routine', targetId: routine.id };
    }
    return { label: 'Freestyle', kind: 'freestyle', targetId: null };
  });

  protected readonly subtitle = computed(() => this.provenance().label);

  /** Emitted instead of opening the replay, so the row keeps one job. */
  readonly openSource = output<{ kind: 'plan' | 'routine'; id: string }>();

  protected onOpenSource(event: MouseEvent): void {
    event.stopPropagation();
    const p = this.provenance();
    if (p.kind === 'freestyle' || !p.targetId) return;
    this.openSource.emit({ kind: p.kind, id: p.targetId });
  }

  /** Number of exercises logged this session. */
  protected readonly exerciseCount = computed(() => this.log().exercises?.length ?? 0);

  /** Completed sets across all exercises. */
  protected readonly setsDone = computed(() =>
    (this.log().exercises ?? []).reduce(
      (n: number, e: LoggedExercise) =>
        n + (e.sets ?? []).filter((s: LoggedSet) => s.isCompleted).length,
      0,
    ),
  );

  /** Total sets logged this session (completed + not). */
  protected readonly setsTotal = computed(() =>
    (this.log().exercises ?? []).reduce(
      (n: number, e: LoggedExercise) => n + (e.sets ?? []).length,
      0,
    ),
  );

  /**
   * Sets meta text. Clean "6 sets" when every set was completed; surfaces
   * the ratio "5/8 sets" when the session was only partially finished, so a
   * cut-short workout doesn't read as a clean one. Plural off the total.
   */
  protected readonly setsLabel = computed(() => {
    const total = this.setsTotal();
    if (total === 0) return '';
    const done = this.setsDone();
    const count = done === total ? `${total}` : `${done}/${total}`;
    return `${count} ${total === 1 ? 'set' : 'sets'}`;
  });

  /** Session notes, trimmed — drives the comment indicator + its tooltip. */
  protected readonly notesText = computed(() => this.log().notes?.trim() ?? '');
  protected readonly hasNotes = computed(() => this.notesText().length > 0);

  protected readonly feelingGlyph = computed<string | null>(() => {
    const r = this.log().feelingRating;
    if (r == null) return null;
    return this._feelingGlyphs[Math.max(1, Math.min(5, r)) - 1];
  });

  protected readonly prCount = computed(() => this.log().prCount ?? 0);

  /** "PR" / "3 PRs" badge text — empty when no PRs. */
  protected readonly prLabel = computed(() => {
    const n = this.prCount();
    return n === 0 ? '' : n === 1 ? 'PR' : `${n} PRs`;
  });

  /** Left-edge tone — teal when a PR was set, honey otherwise. */
  protected readonly tone = computed<WorkoutRowTone>(() =>
    this.prCount() > 0 ? WorkoutRowTone.Pr : WorkoutRowTone.Default,
  );

  // ─── Events ───────────────────────────────────────────────────────────

  protected onOpen(): void {
    this.open.emit();
  }

  /** Keyboard activation — Enter/Space open the replay (like a button). */
  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      (event.target as HTMLElement).click();
    }
  }
}
