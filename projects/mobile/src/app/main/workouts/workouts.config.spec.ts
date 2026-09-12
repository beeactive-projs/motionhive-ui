/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import {
  WORKOUT_ICONS,
  clockDigitsToDisplay,
  clockDigitsToSeconds,
  elapsedLabel,
  planPositionLabel,
  routineTone,
  secondsToClock,
  workoutDuration,
  workoutMetaLine,
} from './workouts.config';

/** Every template in this feature, inlined at build time by Vite. */
const templates = import.meta.glob('./**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Component sources too — action sheets name their glyphs in TypeScript. */
const sources = import.meta.glob(['./**/*.ts', '!./**/*.spec.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * Icon names this feature renders: static `name="…"` attributes, plus the
 * `icon: '…-outline'` literals that bound names (`[name]="item.icon"`) are
 * fed from. Scanning only the templates missed every icon an action sheet
 * declares, which is the same blank-box failure one layer further back.
 */
function iconNamesUsed(): Set<string> {
  const found = new Set<string>();
  for (const html of Object.values(templates)) {
    for (const match of html.matchAll(/<ion-icon[^>]*\bname="([a-z-]+)"/g)) {
      found.add(match[1]);
    }
  }
  for (const ts of Object.values(sources)) {
    for (const match of ts.matchAll(/\bicon:\s*'([a-z][a-z-]*)'/g)) {
      found.add(match[1]);
    }
  }
  return found;
}

const kebab = (key: string) => key.replace(/([A-Z])/g, '-$1').toLowerCase();

describe('workouts config', () => {
  // An unregistered icon renders as a blank box with no error — which is how
  // the set tick, the single most-used control in the logger, shipped
  // invisible once. This is the guard.
  it('registers every icon it renders, from templates and from code', () => {
    const registered = new Set(Object.keys(WORKOUT_ICONS).map(kebab));
    for (const name of iconNamesUsed()) {
      expect(registered, `${name} is rendered but not registered`).toContain(name);
    }
  });

  it('rotates routine tones so a list never reads as one grey block', () => {
    expect(routineTone(0)).not.toBe(routineTone(1));
    // Stable per index, so a row keeps its colour across a re-render.
    expect(routineTone(0)).toBe(routineTone(5));
  });

  it('names only the parts of the meta line it actually knows', () => {
    expect(workoutMetaLine(6, 55, 'Barbell')).toBe('6 exercises · ~55 min · Barbell');
    expect(workoutMetaLine(1, null)).toBe('1 exercise');
    expect(workoutMetaLine(null, null)).toBe('');
  });

  it('counts weeks and days from one, not zero', () => {
    expect(planPositionLabel('Strength block', 2, 1)).toBe(
      'STRENGTH BLOCK · WEEK 3 · DAY 2',
    );
    expect(planPositionLabel(null, 0, 0)).toBe('WEEK 1 · DAY 1');
  });

  // A hold is read as a clock, never as a count of seconds.
  it('shows a duration as a clock', () => {
    expect(secondsToClock(90)).toBe('1:30');
    expect(secondsToClock(45)).toBe('0:45');
    expect(secondsToClock(600)).toBe('10:00');
    expect(secondsToClock(0)).toBe('0:00');
  });

  // Keypad digits fill right to left, the way every timer input works —
  // typing 1,3,0 means a minute and a half, not a hundred and thirty seconds.
  it('reads keypad digits right to left into seconds', () => {
    expect(clockDigitsToSeconds('130')).toBe(90);
    expect(clockDigitsToSeconds('45')).toBe(45);
    expect(clockDigitsToSeconds('5')).toBe(5);
    expect(clockDigitsToSeconds('1000')).toBe(600);
    expect(clockDigitsToSeconds('')).toBeNull();
  });

  it('shows those digits back as the clock they are building', () => {
    expect(clockDigitsToDisplay('1')).toBe('0:01');
    expect(clockDigitsToDisplay('13')).toBe('0:13');
    expect(clockDigitsToDisplay('130')).toBe('1:30');
    expect(clockDigitsToDisplay('')).toBe('0:00');
  });

  // One formatter for a workout's length, delegating to core's.
  it('formats a workout length, and says nothing when there is none', () => {
    expect(workoutDuration(1860)).toBe('31m');
    expect(workoutDuration(3900)).toBe('1h 5m');
    expect(workoutDuration(null)).toBe('');
    expect(workoutDuration(0)).toBe('');
  });

  it('reads elapsed time off the start instant, never a tick count', () => {
    const started = new Date('2026-09-12T10:00:00Z');
    const now = started.getTime() + 74_000;
    expect(elapsedLabel(started.toISOString(), now)).toBe('1:14');
    // An hour in, minutes alone would be ambiguous.
    expect(elapsedLabel(started.toISOString(), started.getTime() + 3_900_000)).toBe('1:05');
    // A clock that has not moved is 0:00, never negative.
    expect(elapsedLabel(started.toISOString(), started.getTime() - 5_000)).toBe('0:00');
  });
});
