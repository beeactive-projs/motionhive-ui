import {
  addOutline,
  timeOutline,
  linkOutline,
  albumsOutline,
  alertCircleOutline,
  arrowForwardOutline,
  barbellOutline,
  calendarOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  chevronForwardOutline,
  closeOutline,
  copyOutline,
  createOutline,
  ellipseOutline,
  ellipsisHorizontalOutline,
  eyeOffOutline,
  flashOutline,
  lockClosedOutline,
  notificationsOutline,
  optionsOutline,
  pauseOutline,
  peopleOutline,
  personAddOutline,
  playSkipForwardOutline,
  refreshOutline,
  removeOutline,
  repeatOutline,
  trashOutline,
  unlinkOutline,
} from 'ionicons/icons';

import {
  Program,
  ProgramAssignment,
  ProgramAssignmentStatus,
  ProgramSize,
  ProgramSizes,
  ProgramSource,
  ProgramStatus,
  appLocale,
  translate,
  weekdayNames,
} from 'core';

import { SheetAction } from '../../_shared/components/action-sheet/action-sheet.model';
import { SpineTone, SpineTones } from '../../_shared/models/spine-tone.model';
import { daysBetween } from '../../_shared/utils/dates';
import { BadgeTone, BadgeTones } from '../exercises/exercises.config';
import { shortDayLabel } from '../workouts/workouts.config';

/**
 * Every icon these screens render. An unregistered name draws a blank box
 * with no error, so `programs.config.spec.ts` asserts this covers both the
 * templates and the names assembled in TypeScript.
 */
export const PROGRAM_ICONS = {
  addOutline,
  timeOutline,
  linkOutline,
  albumsOutline,
  alertCircleOutline,
  arrowForwardOutline,
  barbellOutline,
  calendarOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  chevronForwardOutline,
  closeOutline,
  copyOutline,
  createOutline,
  ellipseOutline,
  ellipsisHorizontalOutline,
  eyeOffOutline,
  flashOutline,
  lockClosedOutline,
  notificationsOutline,
  optionsOutline,
  pauseOutline,
  peopleOutline,
  personAddOutline,
  playSkipForwardOutline,
  refreshOutline,
  removeOutline,
  repeatOutline,
  trashOutline,
  unlinkOutline,
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

/**
 * "12 weeks · 3 days/week" for a program; "Routine · 6 exercises" for a
 * routine, which is how a row tells the two apart in words (the spine says it
 * in colour). Both counts come with the list row (`GET /programs`), which
 * carries no tree to count from.
 */
export function programMeta(program: Program): string {
  if (program.isSingleWorkout) {
    const count = program.exerciseCount ?? 0;
    if (count > 0) {
      return translate('programs.row.routineExercises', { count });
    }
    return translate('programs.row.routine');
  }
  const parts: string[] = [];
  const weeks = weeksOf(program);
  if (weeks) {
    parts.push(translate('count.weeks', { count: weeks }));
  }
  const days = program.daysPerWeek ?? 0;
  if (days > 0) {
    parts.push(translate('programs.row.daysPerWeek', { count: days }));
  }
  return parts.join(' · ');
}

/**
 * When a draft was last touched: "Edited today", "Edited yesterday", else
 * "Edited 7 Nov" (with the year once it is not this one). Counted in local
 * days, so yesterday evening is yesterday rather than "19 hours ago".
 */
export function editedLabel(
  program: Pick<Program, 'updatedAt' | 'isSingleWorkout'>,
  now: number,
): string {
  // Romanian agrees the word with what was edited: a routine is feminine.
  let kind = 'program';
  if (program.isSingleWorkout) {
    kind = 'routine';
  }
  const days = daysBetween(program.updatedAt, now);
  if (days <= 0) {
    return translate('programs.row.edited.today', { kind });
  }
  if (days === 1) {
    return translate('programs.row.edited.yesterday', { kind });
  }
  const edited = new Date(program.updatedAt);
  const format: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (edited.getFullYear() !== new Date(now).getFullYear()) {
    format.year = 'numeric';
  }
  return translate('programs.row.edited.onDate', {
    kind,
    date: edited.toLocaleDateString(appLocale(), format),
  });
}

/**
 * The note at the end of a library row. A draft says when it was last
 * edited, since nobody can follow it yet. Anything else says how many of
 * your clients follow it, "No clients" included: nobody on it is worth
 * knowing. A MotionHive starter speaks only when some do, since it sits in
 * every coach's library and "No clients" on each would be noise.
 */
export function programRowTrailing(program: Program, now: number): string {
  if (program.status === ProgramStatus.Draft) {
    if (!program.updatedAt) {
      return '';
    }
    return editedLabel(program, now);
  }
  const count = program.clientCount;
  if (count === undefined) {
    return '';
  }
  if (count > 0) {
    return translate('count.clients', { count });
  }
  if (program.source === ProgramSource.System) {
    return '';
  }
  return translate('programs.row.noClients');
}

/**
 * The name a new program is born with, in every language the app speaks:
 * `programs.builder.untitledProgram` in `public/i18n/en.json` and `ro.json`
 * (the spec keeps them in step). A draft made in one language and opened in
 * the other still wears the first one's, so both count as no name. The API
 * refuses to publish either (`program-publish.ts`).
 */
export const UNTITLED_PROGRAM_NAMES: readonly string[] = ['Untitled program', 'Program fără titlu'];

/** A name someone gave the program: not empty, and not the untouched default. */
export function hasProgramName(name: string | null | undefined): boolean {
  if (!name) {
    return false;
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return false;
  }
  return !UNTITLED_PROGRAM_NAMES.includes(trimmed);
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

/**
 * `label` and `hint` are translation keys; the sheet's template translates
 * them. Honey for the program, teal for the routine (as on the Workouts "+"
 * sheet), and sky for the starters, a catalogue to browse.
 */
export const CREATE_OPTIONS: readonly SheetAction<CreateChoice>[] = [
  {
    id: CreateChoices.Program,
    label: 'programs.create.newProgram',
    hint: 'programs.create.newProgramHint',
    icon: 'albums-outline',
    color: 'primary',
  },
  {
    id: CreateChoices.Routine,
    label: 'programs.create.newRoutine',
    hint: 'programs.create.newRoutineHint',
    icon: 'repeat-outline',
    color: 'teal',
  },
  {
    id: CreateChoices.Starters,
    label: 'programs.create.browseStarters',
    hint: 'programs.create.browseStartersHint',
    icon: 'flash-outline',
    color: 'info',
    tone: 'shade',
  },
];

// ─── One program's actions ────────────────────────────────────────────────

/**
 * The verbs behind a program's ⋯ (see docs/MOBILE-ACTIONS.md). Neither
 * Publish nor Assign is among them: the builder's footer holds the step the
 * screen is waiting on, Publish while it is a draft and Assign once it is
 * published (owner decision, 2026-11-20, as the Builder design draws it). A
 * verb is never in both places, so the ⋯ keeps the rest.
 */
export const ProgramActionIds = {
  EditDetails: 'editDetails',
  ViewAssignments: 'viewAssignments',
  Duplicate: 'duplicate',
  Unpublish: 'unpublish',
  Delete: 'delete',
} as const;

export type ProgramActionId = (typeof ProgramActionIds)[keyof typeof ProgramActionIds];

/**
 * `label` and `hint` are translation keys; the sheet translates them. Each
 * tile takes its concept's hue: the assignments are people (violet), the
 * copy teal, unpublishing makes it private (violet). View assignments leads
 * a published program's sheet, the one about who has it; Assign itself is
 * the footer's.
 */
export const PROGRAM_ACTIONS: readonly SheetAction<ProgramActionId>[] = [
  {
    id: ProgramActionIds.ViewAssignments,
    label: 'programs.settings.viewAssignments',
    icon: 'people-outline',
    color: 'violet',
  },
  {
    id: ProgramActionIds.EditDetails,
    label: 'programs.actions.editDetails',
    icon: 'create-outline',
    color: 'primary',
  },
  {
    id: ProgramActionIds.Duplicate,
    label: 'button.duplicate',
    icon: 'copy-outline',
    color: 'teal',
  },
  {
    id: ProgramActionIds.Unpublish,
    label: 'programs.settings.unpublish',
    hint: 'programs.actions.unpublishHint',
    icon: 'eye-off-outline',
    color: 'violet',
  },
  {
    id: ProgramActionIds.Delete,
    label: 'programs.settings.delete.title',
    icon: 'trash-outline',
    color: 'danger',
    destructive: true,
  },
];

/** A MotionHive starter is in everyone's library and nobody's to change. */
export function isOwnProgram(program: Program): boolean {
  return program.source !== ProgramSource.System;
}

/**
 * Only the verbs that apply to this program as it is now: assignments exist
 * once it is published, and a starter can be copied (and assigned, from the
 * footer) but not changed.
 */
export function visibleProgramActions(program: Program): SheetAction<ProgramActionId>[] {
  const own = isOwnProgram(program);
  const published = program.status === ProgramStatus.Published;
  return PROGRAM_ACTIONS.filter((action) => {
    switch (action.id) {
      case ProgramActionIds.ViewAssignments:
        return published;
      case ProgramActionIds.Unpublish:
        return own && published;
      case ProgramActionIds.Duplicate:
        return true;
      case ProgramActionIds.EditDetails:
      case ProgramActionIds.Delete:
        return own;
    }
  });
}

// ─── One week's actions ───────────────────────────────────────────────────

/** The verbs behind a week's ⋯ in the builder (design "WeekSheet"). */
export const WeekActionIds = {
  Copy: 'copy',
  InsertAfter: 'insertAfter',
  Clear: 'clear',
  Delete: 'delete',
} as const;

export type WeekActionId = (typeof WeekActionIds)[keyof typeof WeekActionIds];

/** What decides which of a week's verbs apply. */
export interface WeekActionContext {
  /** Days in the week, rest days not counted. */
  days: number;
  /** Weeks in the program. */
  weekCount: number;
}

/**
 * Only the verbs that apply to this week now. Copy needs days to copy and
 * another week to copy into; a week is added only under the 104-week cap;
 * Clear needs days to clear; a program keeps at least one week, so the last
 * one cannot be deleted. Copy is teal (a copy), adding one honey (it
 * creates). Clearing and deleting both lose the week's days, so they are
 * the red verbs in their own card, each confirmed (docs/MOBILE-ACTIONS.md).
 */
export function weekActions(context: WeekActionContext): SheetAction<WeekActionId>[] {
  const actions: SheetAction<WeekActionId>[] = [];
  if (context.days > 0 && context.weekCount > 1) {
    actions.push({
      id: WeekActionIds.Copy,
      label: 'programs.builder.weekMenu.copy',
      icon: 'copy-outline',
      color: 'teal',
    });
  }
  if (context.weekCount < MAX_PROGRAM_WEEKS) {
    actions.push({
      id: WeekActionIds.InsertAfter,
      label: 'programs.builder.weekMenu.insertAfter',
      icon: 'add-outline',
      color: 'primary',
    });
  }
  if (context.days > 0) {
    actions.push({
      id: WeekActionIds.Clear,
      label: 'programs.builder.weekMenu.clear',
      icon: 'refresh-outline',
      color: 'danger',
      destructive: true,
    });
  }
  if (context.weekCount > 1) {
    actions.push({
      id: WeekActionIds.Delete,
      label: 'programs.builder.weekMenu.delete',
      icon: 'trash-outline',
      color: 'danger',
      destructive: true,
    });
  }
  return actions;
}

/**
 * What deleting week `weekIndex` (0-based) does to the weeks after it, in
 * the words the confirm uses: "Weeks 3 to 8 move up and become weeks 2 to
 * 7. The program ends up with 7 weeks."
 */
export function deleteWeekShift(weekIndex: number, weekCount: number): string {
  const weeks = weekCount - 1;
  const later = weekCount - weekIndex - 1;
  if (later <= 0) {
    return translate('programs.builder.deleteWeek.ends', { weeks });
  }
  return translate('programs.builder.deleteWeek.shift', {
    count: later,
    from: weekIndex + 2,
    last: weekCount,
    to: weekIndex + 1,
    newLast: weekCount - 1,
    weeks,
  });
}

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
    tone: BadgeTones.Warning,
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
      // The start date tells two runs of the same plan for one client apart.
      return translate('programs.assignment.startedPercent', {
        date: shortDayLabel(row.startDate),
        percent: row.completionPercent,
      });
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

/**
 * Which date a week/day lands on when the coach has remapped the program's
 * days onto chosen weekdays.
 *
 * Anchored on the Monday of the start date's week, so `dayIndex` names a
 * weekday rather than an offset — the same grid the server builds. On that
 * grid week 0 can begin before the start date; count from
 * `weekdayScheduleStart` instead of the start date so it never does.
 */
export function scheduledDateFromMonday(
  startDate: string,
  weekIndex: number,
  dayIndex: number,
): Date {
  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  // 0=Mon..6=Sun, matching `dayIndex`.
  const daysSinceMonday = (start.getDay() + 6) % 7;
  const monday = new Date(start);
  monday.setDate(start.getDate() - daysSinceMonday);
  monday.setDate(monday.getDate() + weekIndex * DAYS_PER_WEEK + dayIndex);
  return monday;
}

/**
 * The date a weekday-mapped schedule counts from: the start date, or a week
 * later when a picked weekday falls earlier in the start week than the start
 * itself. The server's rule (`ProgramAssignmentService.scheduleStart`), so the
 * preview shows the dates that will be saved: nothing before the start, the
 * whole plan moved together so its days keep their order.
 *
 * `weekZeroDays` are week 0's sessions as weekdays after the remap, 0=Mon..6=Sun.
 */
export function weekdayScheduleStart(startDate: string, weekZeroDays: readonly number[]): string {
  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const startIndex = (start.getDay() + 6) % 7;
  if (!weekZeroDays.some((day) => day < startIndex)) return startDate;
  start.setDate(start.getDate() + DAYS_PER_WEEK);
  const mm = String(start.getMonth() + 1).padStart(2, '0');
  const dd = String(start.getDate()).padStart(2, '0');
  return `${start.getFullYear()}-${mm}-${dd}`;
}

/** Local calendar day, not UTC — a start date is a day, not an instant. */
export function todayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}
