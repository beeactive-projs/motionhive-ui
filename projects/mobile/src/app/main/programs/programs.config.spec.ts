/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { ProgramAssignmentStatus, ProgramSource, ProgramStatus } from 'core';

import en from '../../../../public/i18n/en.json';
import ro from '../../../../public/i18n/ro.json';
import { SpineTones } from '../../_shared/models/spine-tone.model';
import {
  PROGRAM_ICONS,
  ProgramActionIds,
  UNTITLED_PROGRAM_NAMES,
  assignmentChip,
  assignmentSubline,
  assignmentSublineParts,
  assignmentTone,
  editedLabel,
  hasProgramName,
  programMeta,
  programRowTrailing,
  programTone,
  scheduledDateFor,
  visibleProgramActions,
  WeekActionIds,
  deleteWeekShift,
  weekActions,
  weekdayScheduleStart,
  weeksOf,
  weeksToDays,
} from './programs.config';

const templates = import.meta.glob('./**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const sources = import.meta.glob(['./**/*.ts', '!./**/*.spec.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * Icon names this feature renders: static `name="…"` on `ion-icon`, static
 * `icon="…"` on the shared components that draw one, and the `icon: '…'`
 * literals bound names are fed from.
 */
function iconNamesUsed(): Set<string> {
  const found = new Set<string>();
  for (const html of Object.values(templates)) {
    for (const m of html.matchAll(/<ion-icon[^>]*\bname="([a-z-]+)"/g)) found.add(m[1]);
    for (const m of html.matchAll(/\sicon="([a-z-]+)"/g)) found.add(m[1]);
  }
  for (const ts of Object.values(sources)) {
    for (const m of ts.matchAll(/\bicon:\s*'([a-z][a-z-]*)'/g)) found.add(m[1]);
  }
  return found;
}

const kebab = (key: string) => key.replace(/([A-Z])/g, '-$1').toLowerCase();

/** Enough of a Program to exercise the helpers. */
const program = (over: Record<string, unknown> = {}) =>
  ({
    id: 'p1',
    name: 'Block',
    status: ProgramStatus.Published,
    isSingleWorkout: false,
    durationDays: 28,
    workouts: [],
    ...over,
  }) as never;

/** Enough of a ProgramAssignment to exercise the row copy. */
const assignment = (over: Record<string, unknown> = {}) =>
  ({
    id: 'a1',
    status: ProgramAssignmentStatus.Active,
    startDate: '2026-09-07',
    completionPercent: 25,
    ...over,
  }) as never;

describe('programs config', () => {
  it('registers every icon it renders, from templates and from code', () => {
    const registered = new Set(Object.keys(PROGRAM_ICONS).map(kebab));
    for (const name of iconNamesUsed()) {
      expect(registered, `${name} is rendered but not registered`).toContain(name);
    }
  });

  // The spine is the only thing telling a program from a routine at a glance,
  // and a draft has to read as unassignable before you tap into it.
  it('keys the spine to what a row is, and dims a draft', () => {
    expect(programTone(program())).toBe(SpineTones.Honey);
    expect(programTone(program({ isSingleWorkout: true }))).toBe(SpineTones.Teal);
    expect(programTone(program({ status: ProgramStatus.Draft }))).toBe(SpineTones.Muted);
    expect(programTone(program({ isSingleWorkout: true, status: ProgramStatus.Draft }))).toBe(
      SpineTones.Muted,
    );
  });

  // The row has no Routine badge: its meta line says it, with the count the
  // list row carries (it has no tree to count from).
  it('names a routine and counts its exercises from the list row', () => {
    expect(programMeta(program({ isSingleWorkout: true, exerciseCount: 6 }))).toBe(
      'Routine · 6 exercises',
    );
    expect(programMeta(program({ isSingleWorkout: true, exerciseCount: 1 }))).toBe(
      'Routine · 1 exercise',
    );
    expect(programMeta(program({ isSingleWorkout: true }))).toBe('Routine');
  });

  // The list carries no workouts, so days per week used to read 0 forever.
  it("says a program's weeks and the days a week it trains, from the list row", () => {
    expect(programMeta(program({ durationDays: 56, daysPerWeek: 3 }))).toBe(
      '8 weeks · 3 days/week',
    );
    expect(programMeta(program({ durationDays: 56 }))).toBe('8 weeks');
    expect(programMeta(program({ durationDays: null, daysPerWeek: 4 }))).toBe('4 days/week');
  });

  it('says when a draft was edited, in local days', () => {
    const now = new Date(2026, 10, 20, 9, 0).getTime();
    const at = (day: number, hour = 22) => new Date(2026, 10, day, hour, 0).toISOString();
    expect(editedLabel({ updatedAt: at(20, 7), isSingleWorkout: false }, now)).toBe('Edited today');
    // Last night is yesterday, not "11 hours ago".
    expect(editedLabel({ updatedAt: at(19), isSingleWorkout: false }, now)).toBe('Edited yesterday');
    expect(editedLabel({ updatedAt: at(7), isSingleWorkout: true }, now)).toBe('Edited 7 Nov');
    expect(
      editedLabel({ updatedAt: new Date(2025, 11, 30).toISOString(), isSingleWorkout: false }, now),
    ).toBe('Edited 30 Dec 2025');
  });

  it("ends a row with its clients, or a draft's last edit", () => {
    const now = new Date(2026, 10, 20, 9, 0).getTime();
    const yesterday = new Date(2026, 10, 19, 18, 0).toISOString();
    expect(programRowTrailing(program({ clientCount: 3 }), now)).toBe('3 clients');
    expect(programRowTrailing(program({ clientCount: 1 }), now)).toBe('1 client');
    // Nobody on it is worth saying on your own program.
    expect(programRowTrailing(program({ clientCount: 0 }), now)).toBe('No clients');
    expect(
      programRowTrailing(
        program({ status: ProgramStatus.Draft, clientCount: 2, updatedAt: yesterday }),
        now,
      ),
    ).toBe('Edited yesterday');
    // A starter is in every library: it speaks only when some follow it.
    expect(programRowTrailing(program({ source: ProgramSource.System, clientCount: 0 }), now)).toBe('');
    expect(programRowTrailing(program({ source: ProgramSource.System, clientCount: 2 }), now)).toBe(
      '2 clients',
    );
    expect(programRowTrailing(program(), now)).toBe('');
  });

  it("knows the name a new program is born with, in both languages' files", () => {
    expect(UNTITLED_PROGRAM_NAMES).toEqual([
      en.programs.builder.untitledProgram,
      ro.programs.builder.untitledProgram,
    ]);
    for (const name of UNTITLED_PROGRAM_NAMES) {
      expect(hasProgramName(name)).toBe(false);
      expect(hasProgramName(`  ${name} `)).toBe(false);
    }
    expect(hasProgramName('')).toBe(false);
    expect(hasProgramName('   ')).toBe(false);
    expect(hasProgramName(null)).toBe(false);
    expect(hasProgramName('Strength base')).toBe(true);
  });

  it('converts between the weeks it is authored in and the days it is stored as', () => {
    expect(weeksOf(program({ durationDays: 28 }))).toBe(4);
    expect(weeksToDays(6)).toBe(42);
    // Open-ended is a real answer, not zero weeks.
    expect(weeksOf(program({ durationDays: null }))).toBeNull();
    // A part week still counts as a week of the plan.
    expect(weeksOf(program({ durationDays: 30 }))).toBe(5);
  });

  // ACTIVE is silent on purpose: it is what most rows are, and a chip on
  // every row is a chip that says nothing.
  it('chips only the assignment states that are exceptions', () => {
    expect(assignmentChip(ProgramAssignmentStatus.Active)).toBeNull();
    expect(assignmentChip(ProgramAssignmentStatus.Paused)?.label).toBe('Paused');
    expect(assignmentChip(ProgramAssignmentStatus.Pending)?.label).toBe('Not started');
    expect(assignmentChip(ProgramAssignmentStatus.Cancelled)?.label).toBe('Cancelled');
  });

  // Every state must map to a tone the `.mh-session-row` skin actually
  // paints — ACTIVE once mapped to a name the stylesheet did not know and
  // shipped with no spine at all.
  it('gives every assignment state a spine the row skin knows', () => {
    const known = new Set(Object.values(SpineTones));
    for (const status of Object.values(ProgramAssignmentStatus)) {
      expect(known, `${status} has no paintable spine`).toContain(assignmentTone(status));
    }
    expect(assignmentTone(ProgramAssignmentStatus.Active)).toBe(SpineTones.Booked);
  });

  // The paused promise is the whole point of pausing.
  it('says what resuming a paused assignment does', () => {
    expect(assignmentSubline(assignment({ status: ProgramAssignmentStatus.Paused }))).toMatch(
      // What really happens: resuming moves the open days forward by whole
      // weeks, so nothing missed during the pause counts against the client.
      /resuming moves them forward by whole weeks/,
    );
    // Started is the fact a coach scans for; the percentage alone hid it.
    expect(assignmentSubline(assignment())).toMatch(/^Started .+ · 25% done$/);
    expect(assignmentSubline(assignment({ status: ProgramAssignmentStatus.Cancelled }))).toBe('');
  });

  // A narrow row wraps between the parts, so "25% done" never splits.
  it('gives the line in parts that wrap whole', () => {
    const parts = assignmentSublineParts(assignment());
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^Started /);
    expect(parts[1]).toBe('25% done');
    expect(assignmentSublineParts(assignment({ status: ProgramAssignmentStatus.Paused }))).toHaveLength(1);
    expect(assignmentSublineParts(assignment({ status: ProgramAssignmentStatus.Cancelled }))).toEqual([]);
  });

  // The ⋯ lists only what applies now (docs/MOBILE-ACTIONS.md): a draft can't
  // be handed out yet, and a starter is MotionHive's to change, not the coach's.
  // Assign is the published program's footer button, so never in the ⋯ too.
  it('offers only the actions that apply to the program as it is', () => {
    const ids = (over: Record<string, unknown>) => visibleProgramActions(program(over)).map((a) => a.id);
    expect(ids({ source: ProgramSource.Instructor })).toEqual([
      ProgramActionIds.ViewAssignments,
      ProgramActionIds.EditDetails,
      ProgramActionIds.Duplicate,
      ProgramActionIds.Unpublish,
      ProgramActionIds.Delete,
    ]);
    expect(ids({ source: ProgramSource.Instructor, status: ProgramStatus.Draft })).toEqual([
      ProgramActionIds.EditDetails,
      ProgramActionIds.Duplicate,
      ProgramActionIds.Delete,
    ]);
    expect(ids({ source: ProgramSource.System })).toEqual([
      ProgramActionIds.ViewAssignments,
      ProgramActionIds.Duplicate,
    ]);
  });

  // A week's ⋯ (design "WeekSheet"): only the verbs that can apply to it.
  it("offers a week's verbs only where they apply", () => {
    const ids = (days: number, weekCount: number) =>
      weekActions({ days, weekCount }).map((action) => action.id);
    expect(ids(3, 8)).toEqual([
      WeekActionIds.Copy,
      WeekActionIds.InsertAfter,
      WeekActionIds.Clear,
      WeekActionIds.Delete,
    ]);
    // Nothing to copy or clear in a week of rest.
    expect(ids(0, 8)).toEqual([WeekActionIds.InsertAfter, WeekActionIds.Delete]);
    // The only week: nowhere to copy to, and a program keeps one week.
    expect(ids(2, 1)).toEqual([WeekActionIds.InsertAfter, WeekActionIds.Clear]);
    // At 104 weeks there is no room for another.
    expect(ids(2, 104)).not.toContain(WeekActionIds.InsertAfter);
    // Both verbs that lose days are red, in their own card.
    const red = weekActions({ days: 3, weekCount: 8 }).filter((action) => action.destructive);
    expect(red.map((action) => action.id)).toEqual([WeekActionIds.Clear, WeekActionIds.Delete]);
  });

  it('says where the weeks after a deleted one go, with no dash between them', () => {
    expect(deleteWeekShift(1, 8)).toBe(
      'Weeks 3 to 8 move up and become weeks 2 to 7. The program ends up with 7 weeks.',
    );
    expect(deleteWeekShift(6, 8)).toBe(
      'Week 8 moves up and becomes week 7. The program ends up with 7 weeks.',
    );
    expect(deleteWeekShift(7, 8)).toBe('The program ends up with 7 weeks.');
    expect(deleteWeekShift(0, 2)).toBe(
      'Week 2 moves up and becomes week 1. The program ends up with 1 week.',
    );
  });

  // The assign preview is only as good as this maths: a start date on the
  // wrong weekday is the mistake it exists to catch.
  it('lands each week and day on the right calendar date', () => {
    // 2026-09-07 is a Monday.
    expect(scheduledDateFor('2026-09-07', 0, 0).getDate()).toBe(7);
    expect(scheduledDateFor('2026-09-07', 0, 3).getDate()).toBe(10);
    expect(scheduledDateFor('2026-09-07', 1, 0).getDate()).toBe(14);
    // Parsed as a local calendar day, so the weekday survives a timezone
    // west of Greenwich — `new Date('2026-09-07')` would slip to the 6th.
    expect(scheduledDateFor('2026-09-07', 0, 0).getDay()).toBe(1);
  });

  // The server's rule: picked weekdays never put a session before the start.
  it('moves a weekday schedule a week when a day would land before the start', () => {
    // 2026-10-14 is a Wednesday; 0=Mon..6=Sun.
    expect(weekdayScheduleStart('2026-10-14', [0])).toBe('2026-10-21');
    expect(weekdayScheduleStart('2026-10-14', [1, 4])).toBe('2026-10-21');
    // The start day itself and anything after it keep the start week.
    expect(weekdayScheduleStart('2026-10-14', [2, 4])).toBe('2026-10-14');
    expect(weekdayScheduleStart('2026-10-14', [4])).toBe('2026-10-14');
    // A program with nothing in week 0 has nothing to land early.
    expect(weekdayScheduleStart('2026-10-14', [])).toBe('2026-10-14');
  });
});
