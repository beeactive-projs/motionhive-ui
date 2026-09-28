import {
  addOutline,
  albumsOutline,
  alertCircleOutline,
  calendarOutline,
  checkmarkCircleOutline,
  chevronForward,
  closeOutline,
  funnelOutline,
  copyOutline,
  ellipsisHorizontal,
  flashOutline,
  lockClosedOutline,
  peopleOutline,
  personAddOutline,
  removeOutline,
  repeatOutline,
  trashOutline,
} from 'ionicons/icons';

import {
  Program,
  ProgramAssignment,
  ProgramAssignmentStatus,
  ProgramSize,
  ProgramSizes,
  ProgramStatus,
  translate,
  weekdayNames,
} from 'core';

import { SpineTone, SpineTones } from '../../_shared/models/spine-tone.model';
import { BadgeTone, BadgeTones } from '../exercises/exercises.config';
import { shortDayLabel } from '../workouts/workouts.config';

/**
 * Every icon these screens render. An unregistered name draws a blank box
 * with no error, so `programs.config.spec.ts` asserts this covers both the
 * templates and the names assembled in TypeScript.
 */
export const PROGRAM_ICONS = {
  addOutline,
  albumsOutline,
  alertCircleOutline,
  calendarOutline,
  checkmarkCircleOutline,
  chevronForward,
  closeOutline,
  funnelOutline,
  copyOutline,
  ellipsisHorizontal,
  flashOutline,
  lockClosedOutline,
  peopleOutline,
  personAddOutline,
  removeOutline,
  repeatOutline,
  trashOutline,
};

/** Days per week, for turning a stored `durationDays` back into weeks. */
export const DAYS_PER_WEEK = 7;

/** How many weeks a program starts with before the coach sets its length. */
export const DEFAULT_PROGRAM_WEEKS = 4;

/** The BE caps `durationDays` at 728 — 104 weeks. */
export const MAX_PROGRAM_WEEKS = 104;

/**
 * Monday-first labels for the seven day rows of a week card, in the UI
 * locale. A function, not a constant: the locale is only known at runtime.
 */
export function dayLabels(): string[] {
  return weekdayNames('short');
}

export function dayLabel(dayIndex: number): string {
  return dayLabels()[dayIndex] ?? translate('programs.common.day', { number: dayIndex + 1 });
}

export function weekLabel(weekIndex: number): string {
  return translate('programs.common.week', { number: weekIndex + 1 });
}

// ─── Library ──────────────────────────────────────────────────────────────

/**
 * The pill row over the library. The split is a property of each row —
 * `isSingleWorkout` — not a different query, so the pills narrow what is
 * already loaded.
 */
/**
 * Whose content a row is. A coach's library legitimately contains MotionHive
 * starters alongside their own work, and before this there was no way to
 * tell them apart — the question that kept coming up when opening Programs.
 */
export const ProgramOrigins = {
  All: 'all',
  Mine: 'mine',
  Starters: 'starters',
} as const;

export type ProgramOrigin = (typeof ProgramOrigins)[keyof typeof ProgramOrigins];

/**
 * The origin row. Shown only when there is something to separate — a coach
 * with no starters in view gets one axis of pills, not two. Labels are
 * translation keys; the templates translate them.
 */
export const ORIGIN_PILLS: readonly { value: ProgramOrigin; label: string }[] = [
  { value: ProgramOrigins.All, label: 'common.all' },
  { value: ProgramOrigins.Mine, label: 'programs.library.origin.mine' },
  { value: ProgramOrigins.Starters, label: 'programs.library.origin.starters' },
];

export const LIBRARY_PILLS: readonly { value: ProgramSize; label: string }[] = [
  { value: ProgramSizes.All, label: 'common.all' },
  { value: ProgramSizes.Program, label: 'programs.library.size.programs' },
  { value: ProgramSizes.Routine, label: 'programs.library.size.routines' },
];

/**
 * The library's spine tones. The distinction this carries is *what kind of
 * thing* a row is — a multi-week program or a single routine — with an
 * unpublished one dimmed, because a draft cannot be assigned yet.
 */
export function programTone(program: Program): SpineTone {
  if (program.status === ProgramStatus.Draft) return SpineTones.Muted;
  return program.isSingleWorkout ? SpineTones.Teal : SpineTones.Honey;
}

/** "12 weeks · 3 days/week" for a program; "6 exercises" for a routine. */
export function programMeta(program: Program, exerciseCount?: number): string {
  if (program.isSingleWorkout) {
    const n = exerciseCount ?? 0;
    // Silent when the count is unknown: the row already wears a Routine
    // badge, and saying it twice tells you nothing the second time.
    return n ? translate('count.exercises', { count: n }) : '';
  }
  const weeks = weeksOf(program);
  const days = (program.workouts ?? []).length;
  const parts: string[] = [];
  if (weeks) parts.push(translate('count.weeks', { count: weeks }));
  if (weeks && days) {
    parts.push(translate('programs.row.daysPerWeek', { count: Math.round(days / weeks) }));
  }
  return parts.join(' · ');
}

/** Whole weeks a program runs for. Null duration means open-ended. */
export function weeksOf(program: Program): number | null {
  return program.durationDays ? Math.ceil(program.durationDays / DAYS_PER_WEEK) : null;
}

export function weeksToDays(weeks: number): number {
  return weeks * DAYS_PER_WEEK;
}

// ─── Creating ─────────────────────────────────────────────────────────────

/**
 * The three verbs behind the library's one create button. They are the same
 * intent at different sizes, and a starter is the honest third answer for
 * someone who does not want to author at all.
 */
export const CreateChoices = {
  Program: 'program',
  Routine: 'routine',
  Starters: 'starters',
} as const;

export type CreateChoice = (typeof CreateChoices)[keyof typeof CreateChoices];

/** `label` and `hint` are translation keys; the sheet's template translates them. */
export const CREATE_OPTIONS: readonly {
  id: CreateChoice;
  label: string;
  hint: string;
  icon: string;
}[] = [
  {
    id: CreateChoices.Program,
    label: 'programs.create.newProgram',
    hint: 'programs.create.newProgramHint',
    icon: 'albums-outline',
  },
  {
    id: CreateChoices.Routine,
    label: 'programs.create.newRoutine',
    hint: 'programs.create.newRoutineHint',
    icon: 'repeat-outline',
  },
  {
    id: CreateChoices.Starters,
    label: 'programs.create.browseStarters',
    hint: 'programs.create.browseStartersHint',
    icon: 'flash-outline',
  },
];

// ─── Assignments ──────────────────────────────────────────────────────────

/**
 * Assignment states, as the rows say them.
 *
 * ACTIVE is deliberately silent: it is the state almost every row is in, and
 * a chip on every row is a chip that says nothing. Only the exceptions speak.
 * Neutral or semantic washes, never honey — a state is not a thing to press.
 */
const ASSIGNMENT_CHIPS: Record<ProgramAssignmentStatus, { key: string; tone: BadgeTone } | null> = {
  [ProgramAssignmentStatus.Active]: null,
  [ProgramAssignmentStatus.Pending]: {
    key: 'programs.assignment.notStarted',
    tone: BadgeTones.Warn,
  },
  [ProgramAssignmentStatus.Paused]: {
    key: 'enum.programAssignmentStatus.PAUSED',
    tone: BadgeTones.Medium,
  },
  [ProgramAssignmentStatus.Completed]: {
    key: 'enum.programAssignmentStatus.COMPLETED',
    tone: BadgeTones.Teal,
  },
  [ProgramAssignmentStatus.Cancelled]: {
    key: 'enum.programAssignmentStatus.CANCELLED',
    tone: BadgeTones.Danger,
  },
};

/** Translated at call time — the table above holds keys, never copy. */
export function assignmentChip(
  status: ProgramAssignmentStatus,
): { label: string; tone: BadgeTone } | null {
  const chip = ASSIGNMENT_CHIPS[status];
  return chip ? { label: translate(chip.key), tone: chip.tone } : null;
}

/**
 * The spine per state: honey waiting to start, emerald under way, muted
 * paused, teal finished, red cancelled. Every value is a tone the row skin
 * paints — ACTIVE once mapped to a name the stylesheet did not know and
 * shipped with no spine at all.
 */
const ASSIGNMENT_TONES: Record<ProgramAssignmentStatus, SpineTone> = {
  [ProgramAssignmentStatus.Pending]: SpineTones.Honey,
  [ProgramAssignmentStatus.Active]: SpineTones.Booked,
  [ProgramAssignmentStatus.Paused]: SpineTones.Muted,
  [ProgramAssignmentStatus.Completed]: SpineTones.Teal,
  [ProgramAssignmentStatus.Cancelled]: SpineTones.Danger,
};

export function assignmentTone(status: ProgramAssignmentStatus): SpineTone {
  return ASSIGNMENT_TONES[status] ?? SpineTones.Muted;
}

/**
 * The line under a client's name on the assignments list. A paused row says
 * what resume does, because the answer is not obvious and the promise — the
 * client is never retroactively behind — is the whole point of pausing.
 */
export function assignmentSubline(row: ProgramAssignment): string {
  switch (row.status) {
    case ProgramAssignmentStatus.Paused:
      return translate('programs.assignment.pausedSubline');
    case ProgramAssignmentStatus.Pending:
      return translate('programs.assignment.starts', { date: shortDayLabel(row.startDate) });
    case ProgramAssignmentStatus.Active:
    case ProgramAssignmentStatus.Completed:
      return translate('programs.assignment.percentDone', { percent: row.completionPercent });
    default:
      return '';
  }
}

/**
 * Which calendar date a given week/day of a program lands on, counting from
 * the assignment's start. This is what the assign sheet previews — a start
 * date on the wrong weekday is the mistake that otherwise surfaces days later
 * in a message from the client.
 */
export function scheduledDateFor(
  startDate: string,
  weekIndex: number,
  dayIndex: number,
): Date {
  // Parsed as local midnight: a date-only string is a calendar day, and
  // `new Date('2026-09-01')` reads it as UTC, slipping a day west of Greenwich.
  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  start.setDate(start.getDate() + weekIndex * DAYS_PER_WEEK + dayIndex);
  return start;
}

/** Local calendar day, not UTC — a start date is a day, not an instant. */
export function todayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}
