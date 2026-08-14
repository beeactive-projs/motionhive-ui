import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';

import {
  TrainingDay,
  TrainingDayWorkout,
  WorkoutLog,
  WorkoutLogStatus,
} from 'core';

import {
  WeekStrip,
  WeekStripDot,
} from '../../../../../_shared/components/week-strip/week-strip';

/**
 * `mh-today-hero` — the answer to "what am I doing today", above the
 * Workouts tabs.
 *
 * The plan is context, not the headline: the workout name leads and
 * "from Alex · 12-week base" sits underneath it. Someone training
 * without a coach sees the same shell with their own routine in the
 * same slot, so nothing reads as a stripped-down coaching tool.
 *
 * Presentational. The parent owns the loads and the navigation; this
 * decides only what to show and emits intent.
 */
@Component({
  selector: 'mh-today-hero',
  standalone: true,
  imports: [ButtonDirective, Card, Tag, WeekStrip],
  templateUrl: './today-hero.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayHero {
  readonly trainingDay = input<TrainingDay | null>(null);
  /** An unfinished log takes over the hero — resuming beats starting. */
  readonly inProgress = input<WorkoutLog | null>(null);
  readonly routineCount = input(0);
  readonly loading = input(false);
  /** Which day the strip is showing. The host owns it and refetches. */
  readonly selectedDate = input<Date>(new Date());

  readonly resume = output<WorkoutLog>();
  readonly startAssigned = output<TrainingDayWorkout>();
  readonly startFreestyle = output<void>();
  readonly dateSelected = output<Date>();
  /**
   * A delta, not a date. Computing the target here would read the
   * `selectedDate` *input*, which has not propagated yet when the arrow
   * is clicked several times in one tick — three fast clicks all read
   * the same stale anchor and moved a single week. The host owns the
   * signal, so it can do the arithmetic correctly.
   */
  readonly weekShift = output<number>();

  readonly today = computed(() => this.trainingDay()?.today ?? null);
  readonly hasPlan = computed(
    () => (this.trainingDay()?.activePlans.length ?? 0) > 0,
  );

  /**
   * Which of the four situations we're in. Every branch has to be a
   * real answer: a rest day is not an error, and someone with no plan
   * is not a broken state.
   */
  readonly mode = computed<
    'in-progress' | 'assigned' | 'done' | 'rest' | 'no-plan'
  >(() => {
    // Only when actually looking at today: an unfinished log belongs to
    // now, so offering "Resume" while browsing next Wednesday would
    // attach it to a day it has nothing to do with.
    if (this.inProgress() && this.isToday()) return 'in-progress';
    const t = this.today();
    if (t) {
      return t.status === WorkoutLogStatus.Completed ? 'done' : 'assigned';
    }
    return this.hasPlan() ? 'rest' : 'no-plan';
  });

  readonly coachName = computed(() => {
    const i = this.today()?.instructor;
    if (!i) return null;
    return [i.firstName, i.lastName].filter(Boolean).join(' ') || null;
  });

  /**
   * "Alex Petrov · 12-week base" — one demoted line under the name.
   *
   * A self-scheduled routine is its own plan, so its plan name is the
   * workout name; repeating it under the title says nothing.
   */
  readonly contextLine = computed(() => {
    const t = this.today();
    if (!t) return '';
    const planName = t.planName === t.name ? null : t.planName;
    return [this.coachName(), planName].filter(Boolean).join(' · ');
  });

  readonly estimateLabel = computed(() => {
    const m = this.today()?.estimatedDurationMinutes;
    return m ? `about ${m} min` : null;
  });

  /** Next scheduled workout after today, for the rest-day line. */
  readonly nextUp = computed<TrainingDayWorkout | null>(() => {
    const t = this.trainingDay();
    if (!t) return null;
    const todayIso = new Date().toISOString().slice(0, 10);
    return (
      t.week.find(
        (w) =>
          w.scheduledDate != null &&
          w.scheduledDate > todayIso &&
          w.status !== WorkoutLogStatus.Completed,
      ) ?? null
    );
  });

  // ── Week strip ───────────────────────────────────────────────────

  /**
   * Monday of the *selected* week, not of the current one — otherwise
   * paging to next week would snap the strip straight back to today.
   */
  readonly weekStart = computed(() => {
    const sel = this.selectedDate();
    const daysSinceMonday = (sel.getDay() + 6) % 7;
    const d = new Date(sel);
    d.setDate(sel.getDate() - daysSinceMonday);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  /** True when the strip is parked on the real today. */
  readonly isToday = computed(() => {
    const sel = this.selectedDate();
    const now = new Date();
    return (
      sel.getFullYear() === now.getFullYear() &&
      sel.getMonth() === now.getMonth() &&
      sel.getDate() === now.getDate()
    );
  });

  /**
   * Where the selected day sits relative to now.
   *
   * Training happens in the present: you cannot do Thursday's session on
   * Monday, and you cannot go back and do Tuesday's. Other days are for
   * reading — what is coming, what you did, what you missed — so every
   * start action is gated on `isToday()`. Without that gate "Train
   * anyway" sat on a future date and would have started the workout
   * *now*, filed under a day you were only previewing.
   */
  readonly timeframe = computed<'past' | 'today' | 'future'>(() => {
    if (this.isToday()) return 'today';
    const sel = new Date(this.selectedDate());
    sel.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return sel.getTime() < now.getTime() ? 'past' : 'future';
  });

  /** Only today can be acted on. */
  readonly canStart = computed(() => this.timeframe() === 'today');

  /** "Today" only when it is; otherwise name the day you are looking at. */
  readonly dayLabel = computed(() =>
    this.isToday()
      ? 'Today'
      : this.selectedDate().toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
        }),
  );

  shiftWeek(deltaWeeks: number): void {
    this.weekShift.emit(deltaWeeks);
  }

  goToToday(): void {
    this.dateSelected.emit(new Date());
  }

  /**
   * A dot per scheduled workout. Completed work reads teal, outstanding
   * work honey, so the week is scannable without a legend.
   */
  readonly weekDots = computed<Record<string, WeekStripDot[]>>(() => {
    const out: Record<string, WeekStripDot[]> = {};
    for (const w of this.trainingDay()?.week ?? []) {
      if (!w.scheduledDate) continue;
      const tone =
        w.status === WorkoutLogStatus.Completed
          ? ('teal' as const)
          : ('honey' as const);
      (out[w.scheduledDate] ??= []).push({ tone });
    }
    return out;
  });
}
