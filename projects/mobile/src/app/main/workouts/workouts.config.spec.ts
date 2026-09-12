/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import {
  WORKOUT_ICONS,
  elapsedLabel,
  planPositionLabel,
  routineTone,
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
