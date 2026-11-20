import {
  CopyClient,
  CopyDayLock,
  CopyDaySummary,
  CopyExercise,
  CopyExerciseChange,
  CopyLastResult,
  CopyLastSet,
  CopyMoveBounds,
  ExerciseSetType,
  ProgramAssignmentStatus,
  translate,
} from 'core';

import { formatMeasure, prescriptionLine, secondsToClock, shortDayLabel } from '../../workouts/workouts.config';

/**
 * A coach's edit of one client's copy of a plan (owner, 2026-11-20): the
 * pure parts of its two screens, the copy's weeks and a day of it in the
 * day editor. Copy in `programs.clientCopy.*`.
 */

/**
 * The name the copy's lines use: the client's first name ("Changes reach
 * only Anna"), else their last name, else the generic word.
 * @Arguments client, fallback
 */
export function copyClientName(client: CopyClient | null, fallback: string): string {
  if (!client) {
    return fallback;
  }
  const first = client.firstName.trim();
  if (first) {
    return first;
  }
  const last = client.lastName.trim();
  if (last) {
    return last;
  }
  return fallback;
}

/** The two lines over the copy: whose it is, and that only they get the changes. */
export function copyHeader(name: string, program: string): { title: string; banner: string } {
  return {
    title: translate('programs.clientCopy.title', { name }),
    banner: translate('programs.clientCopy.banner', { name, program }),
  };
}

/**
 * Whether a coach can still edit the plan's copy: while it runs or is
 * paused. The entry points ("Edit Anna's copy") show only then.
 * @Arguments status
 */
export function canEditCopy(status: ProgramAssignmentStatus): boolean {
  return status === ProgramAssignmentStatus.Active || status === ProgramAssignmentStatus.Paused;
}

// ─── The weeks ──────────────────────────────────────────────────────────

/** One week of the copy: its days in date order, and whether any can change. */
export interface CopyWeek<T extends CopyDaySummary = CopyDaySummary> {
  weekIndex: number;
  days: T[];
  /** No day of it can change any more. */
  locked: boolean;
}

/**
 * The copy's days by week, weeks in order and days by date. A week whose
 * every day is locked reads as done.
 * @Arguments days
 */
export function copyWeeks<T extends CopyDaySummary>(days: readonly T[]): CopyWeek<T>[] {
  const byWeek = new Map<number, T[]>();
  for (const day of days) {
    const bucket = byWeek.get(day.weekIndex);
    if (bucket) {
      bucket.push(day);
    } else {
      byWeek.set(day.weekIndex, [day]);
    }
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekIndex, list]) => ({
      weekIndex,
      days: [...list].sort((a, b) => dateKey(a).localeCompare(dateKey(b))),
      locked: list.every((day) => !day.editable),
    }));
}

function dateKey(day: CopyDaySummary): string {
  if (day.scheduledDate) {
    return day.scheduledDate;
  }
  return '';
}

/**
 * The weeks drawn open: the first week with a day that can still change and
 * every week after it. The done weeks before it fold into one line.
 * @Arguments weeks
 */
export function openWeeks<T extends CopyDaySummary>(weeks: readonly CopyWeek<T>[]): CopyWeek<T>[] {
  const first = weeks.findIndex((week) => !week.locked);
  if (first < 0) {
    return [];
  }
  return weeks.slice(first);
}

/**
 * "Weeks 1 and 2 are done. You see them in Training, but can't change
 * them." for the run of done weeks before the first open one; empty when
 * there is none.
 * @Arguments weeks
 */
export function doneWeeksLine(weeks: readonly CopyWeek[]): string {
  let count = 0;
  for (const week of weeks) {
    if (!week.locked) {
      break;
    }
    count += 1;
  }
  if (!count) {
    return '';
  }
  return translate('programs.clientCopy.doneWeeks', {
    count,
    first: weeks[0].weekIndex + 1,
    last: weeks[count - 1].weekIndex + 1,
  });
}

/** The short word a locked day shows instead of opening; null for one that opens. */
export function dayLockLabel(lock: CopyDayLock | null): string | null {
  if (lock === null || lock === CopyDayLock.PlanClosed) {
    return null;
  }
  return translate(`programs.clientCopy.lock.${lock}`);
}

/** One day of the copy as its row draws it. */
export interface CopyDayRow {
  id: string;
  name: string;
  line: string;
  /** "Done", "Skipped", "Started", "Past": why it does not open; null when it does. */
  lockLabel: string | null;
  editable: boolean;
  changed: boolean;
  icon: string;
  color: string;
}

/** The tile per state: the plan's barbell while it can change, else what happened. */
const LOCK_TILES: Record<CopyDayLock, { icon: string; color: string }> = {
  [CopyDayLock.Done]: { icon: 'checkmark-circle', color: 'success' },
  [CopyDayLock.Skipped]: { icon: 'play-skip-forward-outline', color: 'violet' },
  [CopyDayLock.Started]: { icon: 'time-outline', color: 'coral' },
  [CopyDayLock.Past]: { icon: 'calendar-outline', color: 'medium' },
  [CopyDayLock.PlanClosed]: { icon: 'calendar-outline', color: 'medium' },
};

/** @Arguments day */
export function copyDayRow(day: CopyDaySummary & { exerciseCount: number }): CopyDayRow {
  let tile = { icon: 'barbell-outline', color: 'primary' };
  if (day.lock !== null) {
    tile = LOCK_TILES[day.lock];
  }
  return {
    id: day.id,
    name: day.name,
    line: copyDayLine(day),
    lockLabel: dayLockLabel(day.lock),
    editable: day.editable,
    changed: day.changed,
    icon: tile.icon,
    color: tile.color,
  };
}

/** "Mon 23 Nov · 5 exercises", the line under a day's name. @Arguments day */
export function copyDayLine(day: CopyDaySummary & { exerciseCount: number }): string {
  const parts: string[] = [];
  if (day.scheduledDate) {
    parts.push(shortDayLabel(day.scheduledDate));
  }
  parts.push(translate('count.exercises', { count: day.exerciseCount }));
  return parts.join(' · ');
}

// ─── A day's exercises ──────────────────────────────────────────────────

/** The label on a changed exercise; null for one as assigned. */
export function copyBadge(change: CopyExerciseChange, name: string): string | null {
  if (change === CopyExerciseChange.Changed) {
    return translate('programs.clientCopy.badge.changed', { name });
  }
  if (change === CopyExerciseChange.Replaced) {
    return translate('programs.clientCopy.badge.replaced');
  }
  if (change === CopyExerciseChange.Added) {
    return translate('programs.clientCopy.badge.added', { name });
  }
  return null;
}

/** "Instead of Overhead press" under a replaced exercise; null otherwise. */
export function insteadOfLine(row: CopyExercise): string | null {
  if (row.change !== CopyExerciseChange.Replaced || !row.program || !row.program.exercise) {
    return null;
  }
  return translate('programs.clientCopy.insteadOf', { name: row.program.exercise.name });
}

/**
 * "In the program: 3 sets · 8–10 reps · 60 kg" under a changed exercise, so
 * the coach sees what they changed it from (the program as it is now).
 * Null for an exercise as assigned, added here, or with no program row.
 * @Arguments row
 */
export function programLine(row: CopyExercise): string | null {
  if (row.change === CopyExerciseChange.None || !row.program || !row.program.sets.length) {
    return null;
  }
  let kind: string | null = null;
  if (row.program.exercise) {
    kind = row.program.exercise.kind;
  }
  return translate('programs.clientCopy.inProgram', {
    line: prescriptionLine(row.program.sets, kind),
  });
}

/**
 * An exercise after a save changed it, until the next read says so: marked
 * as changed (or replaced or added, by its link), and revertable while it
 * has a program row.
 * @Arguments row
 */
export function markedChanged(row: CopyExercise): CopyExercise {
  let change: CopyExerciseChange = CopyExerciseChange.Changed;
  if (row.masterExerciseId === null) {
    change = CopyExerciseChange.Added;
  } else if (row.program && row.program.exerciseId !== row.exerciseId) {
    change = CopyExerciseChange.Replaced;
  }
  return {
    ...row,
    isModifiedFromMaster: true,
    change,
    canRevert: row.program !== null,
  };
}

/** The client's last time on a movement, as the box beside its targets says it. */
export interface LastResultView {
  /** "Last time · 9 Nov". */
  when: string;
  /** "57.5 kg × 8 · 8 · 7". */
  sets: string;
  /** "Average effort 8.5 of 10", or null when they logged none. */
  effort: string | null;
}

/**
 * The last result box, or null when the client has none the coach may read.
 * One weight for every set says it once ("57.5 kg × 8 · 8 · 7"); weights
 * that change are said per set. A hold or a run says its time or distance.
 * @Arguments result
 */
export function lastResultView(result: CopyLastResult | null): LastResultView | null {
  if (!result || !result.sets.length) {
    return null;
  }
  let effort: string | null = null;
  if (result.averageRpe !== null) {
    effort = translate('programs.clientCopy.averageEffort', { value: formatMeasure(result.averageRpe, 1) });
  }
  return {
    when: translate('programs.clientCopy.lastTime', { date: shortDayLabel(result.performedAt) }),
    sets: lastSetsLine(result.sets),
    effort,
  };
}

/** The sets of the last result on one line. @Arguments sets */
export function lastSetsLine(sets: readonly CopyLastSet[]): string {
  const working = sets.filter((set) => set.setType !== ExerciseSetType.Warmup);
  let list = working;
  if (!list.length) {
    list = [...sets];
  }
  const weight = list[0].weightKg;
  const sameWeight = list.every((set) => set.weightKg === weight);
  if (weight !== null && sameWeight && list.every((set) => set.reps !== null)) {
    const kg = translate('workouts.units.kg', { value: formatMeasure(weight) });
    return `${kg} × ${list.map((set) => String(set.reps)).join(' · ')}`;
  }
  return list.map((set) => lastSetText(set)).join(' · ');
}

function lastSetText(set: CopyLastSet): string {
  if (set.weightKg !== null && set.reps !== null) {
    return `${translate('workouts.units.kg', { value: formatMeasure(set.weightKg) })} × ${set.reps}`;
  }
  if (set.reps !== null) {
    return translate('count.reps', { count: set.reps });
  }
  if (set.distanceMeters !== null) {
    return translate('workouts.units.meters', { value: formatMeasure(set.distanceMeters) });
  }
  if (set.durationSeconds !== null) {
    return secondsToClock(set.durationSeconds);
  }
  return '';
}

// ─── Moving a day ───────────────────────────────────────────────────────

/**
 * Whether the day may move to `date`: from the first allowed date to the
 * plan's last, and not a date another day of the plan holds. The picker
 * greys out every other date; the API checks the same.
 * @Arguments date (YYYY-MM-DD), bounds
 */
export function canMoveTo(date: string, bounds: CopyMoveBounds): boolean {
  if (date < bounds.from) {
    return false;
  }
  if (bounds.to !== null && date > bounds.to) {
    return false;
  }
  return !bounds.taken.includes(date);
}
