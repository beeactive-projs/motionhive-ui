/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import {
  PROGRAM_ICONS,
  assignmentChip,
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

function iconNamesUsed(): Set<string> {
  const found = new Set<string>();
  for (const html of Object.values(templates)) {
    for (const m of html.matchAll(/<ion-icon[^>]*\bname="([a-z-]+)"/g)) found.add(m[1]);
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
    status: 'PUBLISHED',
    isSingleWorkout: false,
    durationDays: 28,
    workouts: [],
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
    expect(programTone(program())).toBe('honey');
    expect(programTone(program({ isSingleWorkout: true }))).toBe('teal');
    expect(programTone(program({ status: 'DRAFT' }))).toBe('muted');
    expect(programTone(program({ isSingleWorkout: true, status: 'DRAFT' }))).toBe('muted');
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
    expect(assignmentChip('ACTIVE')).toBeNull();
    expect(assignmentChip('PAUSED')?.label).toBe('Paused');
    expect(assignmentChip('PENDING')?.label).toBe('Not started');
    expect(assignmentChip('CANCELLED')?.label).toBe('Cancelled');
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
