/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { PROFILE_WORKOUT_ICONS, profileWorkoutTiles } from './profile-workout.config';

const templates = import.meta.glob('./*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const sources = import.meta.glob(['./*.ts', '!./*.spec.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

describe('PROFILE_WORKOUT_ICONS', () => {
  // An unregistered name renders as a blank box with no error anywhere.
  it('registers every icon the page renders, and nothing else', () => {
    const used = new Set<string>();
    for (const html of Object.values(templates)) {
      for (const match of html.matchAll(/\b(?:name|icon)="([a-z][a-z0-9-]*)"/g))
        used.add(toCamelCase(match[1]));
    }
    for (const ts of Object.values(sources)) {
      for (const match of ts.matchAll(/\bicon: '([a-z][a-z0-9-]*)'/g))
        used.add(toCamelCase(match[1]));
    }
    const registered = new Set(Object.keys(PROFILE_WORKOUT_ICONS));
    for (const name of used)
      expect(registered, `${name} is used but not registered`).toContain(name);
    for (const name of registered) expect(used, `${name} is registered but unused`).toContain(name);
  });
});

describe('profileWorkoutTiles', () => {
  const minutes = (value: number) => `${Math.round(value)}m`;

  it('shows each figure the workout has', () => {
    expect(
      profileWorkoutTiles(
        { durationSeconds: 3120, setsCompleted: 18, recordCount: 1 },
        minutes,
      ).map((tile) => tile.value),
    ).toEqual(['52m', '18', '1']);
  });

  // An unknown duration or a session with no record is left out, not
  // shown as a dash or a zero.
  it('leaves out what it does not have', () => {
    expect(
      profileWorkoutTiles({ durationSeconds: null, setsCompleted: 4, recordCount: 0 }, minutes).map(
        (tile) => tile.value,
      ),
    ).toEqual(['4']);
  });
});
