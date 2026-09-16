/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { ProgramAssignmentStatus, ProgramStatus } from 'core';

import { SpineTones } from '../../_shared/models/spine-tone.model';
import {
  PROGRAM_ICONS,
  assignmentChip,
  assignmentSubline,
  assignmentTone,
  programMeta,
  programTone,
  scheduledDateFor,
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

  it('says nothing about a routine whose exercise count it does not know', () => {
    // The row already wears a Routine badge; repeating it is noise.
    expect(programMeta(program({ isSingleWorkout: true }))).toBe('');
    expect(programMeta(program({ isSingleWorkout: true }), 6)).toBe('6 exercises');
    expect(programMeta(program({ isSingleWorkout: true }), 1)).toBe('1 exercise');
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
      /shifts the remaining schedule forward/,
    );
    expect(assignmentSubline(assignment())).toBe('25% done');
    expect(assignmentSubline(assignment({ status: ProgramAssignmentStatus.Cancelled }))).toBe('');
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
});
