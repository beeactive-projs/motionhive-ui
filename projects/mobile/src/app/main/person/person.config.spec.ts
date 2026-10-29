/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { ProfileWorkout } from 'core';

import { DETAIL_TILES } from '../../_shared/config/detail-tiles.config';
import { PERSON_ICONS, PersonTabs, personTabs, workoutMonths } from './person.config';

/**
 * The page and its row. The report sheet registers its own glyph, so it is
 * left out here.
 */
const templates = import.meta.glob(['./*.html', './_components/**/*.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Action sheets name their glyphs in TypeScript. */
const sources = import.meta.glob('./person.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** `star-outline` → `starOutline`, the key `addIcons()` registers under. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Static `name="…"` / `icon="…"` attributes, the `icon: '…'` literals the
 * action sheet is fed from, and the detail tiles the About card binds.
 */
function iconNamesUsed(): Set<string> {
  const names = new Set<string>();
  for (const html of Object.values(templates)) {
    for (const match of html.matchAll(/\b(?:name|icon)="([a-z][a-z0-9-]*)"/g)) names.add(match[1]);
  }
  for (const ts of Object.values(sources)) {
    for (const match of ts.matchAll(/\bicon: '([a-z][a-z0-9-]*)'/g)) names.add(match[1]);
  }
  for (const tile of [
    DETAIL_TILES.email,
    DETAIL_TILES.phone,
    DETAIL_TILES.language,
    DETAIL_TILES.timezone,
  ]) {
    names.add(tile.icon);
  }
  return new Set([...names].map(toCamelCase));
}

describe('PERSON_ICONS', () => {
  // An unregistered name renders as a blank box with no error anywhere.
  it('registers every icon the profile renders, and nothing else', () => {
    const used = iconNamesUsed();
    const registered = new Set(Object.keys(PERSON_ICONS));
    for (const name of used)
      expect(registered, `${name} is used but not registered`).toContain(name);
    for (const name of registered) expect(used, `${name} is registered but unused`).toContain(name);
  });
});

describe('personTabs', () => {
  // A segment over a single tab is a control that does nothing.
  it('offers tabs only when both halves have something', () => {
    expect(personTabs({ activity: true, about: true, isCoach: false })).toEqual({
      tabs: [PersonTabs.Activity, PersonTabs.About],
      initial: PersonTabs.Activity,
    });
    expect(personTabs({ activity: true, about: false, isCoach: true })).toEqual({
      tabs: [],
      initial: PersonTabs.Activity,
    });
    expect(personTabs({ activity: false, about: true, isCoach: false })).toEqual({
      tabs: [],
      initial: PersonTabs.About,
    });
    expect(personTabs({ activity: false, about: false, isCoach: false }).initial).toBeNull();
  });

  // What a coach offers is why people open their page.
  it('opens a coach on About', () => {
    expect(personTabs({ activity: true, about: true, isCoach: true }).initial).toBe(
      PersonTabs.About,
    );
  });
});

describe('workoutMonths', () => {
  const workout = (id: string, completedAt: string | null): ProfileWorkout => ({
    id,
    name: id,
    completedAt,
    durationSeconds: null,
    setsCompleted: 0,
    recordCount: 0,
    shareCaption: null,
    hasPhoto: false,
    photoVersion: null,
  });

  it('files workouts under their local month, newest first, as they came', () => {
    const months = workoutMonths([
      workout('a', new Date(2026, 9, 22, 18).toISOString()),
      workout('b', new Date(2026, 9, 1, 7).toISOString()),
      workout('c', new Date(2026, 8, 30, 20).toISOString()),
      workout('open', null),
    ]);
    expect(months.map((m) => [m.key, m.workouts.map((w) => w.id)])).toEqual([
      ['2026-10', ['a', 'b']],
      ['2026-09', ['c']],
    ]);
    expect(months[0].label).toMatch(/2026/);
  });

  // Listed by start, dated by finish: one begun in September and finished in
  // October still files October first.
  it('puts the newest month first whatever order the workouts came in', () => {
    const months = workoutMonths([
      workout('sep', new Date(2026, 8, 14, 18).toISOString()),
      workout('oct', new Date(2026, 9, 14, 9).toISOString()),
    ]);
    expect(months.map((m) => m.key)).toEqual(['2026-10', '2026-09']);
  });
});
