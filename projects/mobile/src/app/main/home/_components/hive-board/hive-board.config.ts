import { WorkoutLog, WorkoutLogStatus, localDayKey } from 'core';

import { CombLayout, HexShape, combLayout } from '../../../../_shared/config/hexagon.config';
import { HivePlace } from '../../home.config';

/**
 * The pure half of `mh-hive-board`, the honeycomb you can tap: where each
 * cell goes, how big the comb is, and the colours a person's cell reads.
 * Tested in `hive-board.config.spec.ts`; the component only paints.
 *
 * A cell is a box one unit wide and as tall as the shape's hexagon on its
 * point (the board's shape, as the Home hive draws it). The boxes
 * tessellate with no spacing, so each box is as big a tap target as the
 * comb allows; the hexagon is drawn a little inside its box, which leaves
 * the sliver between neighbours. Rows tuck a quarter of a box into each
 * other and every other one shifts half a box sideways.
 *
 * A place is `x` in boxes across and `y` in rows; `boardLayout` turns rows
 * into lengths for the shape on screen.
 */

export const BoardLooks = {
  /** An empty place: barely there, never a button. */
  Ghost: 'ghost',
  /** A cell with its track, honey poured in by `fill`. */
  Solid: 'solid',
  /** No track, a dashed edge: a client with no plan, a skipped day. */
  Dashed: 'dashed',
  /** The person alone, at the cell's full size: the coach in the middle. */
  Bare: 'bare',
} as const;

export type BoardLook = (typeof BoardLooks)[keyof typeof BoardLooks];

export const BoardRings = {
  /** Today, in honey (ink on a honey cell, where honey would vanish). */
  Today: 'today',
  /** A week or more without a workout: a calm coral edge. */
  Quiet: 'quiet',
  /** The coach in the middle, picked out in honey. */
  Centre: 'centre',
  /** A trained day shown by its photo: honey around it, as the honey would fill it. */
  Trained: 'trained',
} as const;

export type BoardRing = (typeof BoardRings)[keyof typeof BoardRings];

/** A person inside a cell, drawn as `mh-hex-avatar` draws them. */
export interface BoardAvatar {
  name: string;
  imageUrl: string | null;
  /** Ionic palette name, from `avatarToneFor`. */
  tone: string;
}

/** One cell of the board, ready to paint. */
export interface BoardCell extends HivePlace {
  key: string;
  look: BoardLook;
  /** Honey from the bottom, 0 to 1. */
  fill: number;
  /** What the cell says: a day's number. A person's initials come from `avatar`. */
  label: string;
  /** The accessible name. A cell with one is a button; one without is decoration. */
  name: string | null;
  avatar: BoardAvatar | null;
  /** A photo filling the cell (a day's workout photo). */
  photoUrl: string | null;
  ring: BoardRing | null;
  /** A record was set here. */
  dot: boolean;
  /** Dimmed: a day still to come. */
  faded: boolean;
}

/** A cell with nothing set beyond its place and look. */
export function boardCell(
  place: HivePlace,
  key: string,
  look: BoardLook,
  rest: Partial<Omit<BoardCell, 'x' | 'y' | 'key' | 'look'>> = {},
): BoardCell {
  return {
    x: place.x,
    y: place.y,
    key,
    look,
    fill: 0,
    label: '',
    name: null,
    avatar: null,
    photoUrl: null,
    ring: null,
    dot: false,
    faded: false,
    ...rest,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Axial coordinates (q, r) to a place, before the comb is shifted to 0. */
function axial(q: number, r: number): HivePlace {
  return { x: q + r / 2, y: r };
}

/** Moves a set of places so the top-left one is at 0, 0. */
function shifted(places: readonly HivePlace[]): HivePlace[] {
  if (!places.length) return [];
  const minX = Math.min(...places.map((p) => p.x));
  const minY = Math.min(...places.map((p) => p.y));
  return places.map((p) => ({ x: round(p.x - minX), y: round(p.y - minY) }));
}

/**
 * The sides of a ring, walked clockwise from the top row's left end: along
 * the top, down the right, back along the bottom, up the left. The same
 * order as the Home hive's two rings.
 */
const RING_SIDES: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];

/** Ring `k` around the centre: `6k` cells, clockwise from the top row's left end. */
export function ringAxial(k: number): [number, number][] {
  if (k < 1) return [];
  const cells: [number, number][] = [];
  let q = 0;
  let r = -k;
  for (const [dq, dr] of RING_SIDES) {
    for (let step = 0; step < k; step++) {
      cells.push([q, r]);
      q += dq;
      r += dr;
    }
  }
  return cells;
}

/** How many rings hold `count` cells around a centre: one at least. */
export function ringsFor(count: number): number {
  let rings = 1;
  while (3 * rings * (rings + 1) < count) rings += 1;
  return rings;
}

/**
 * The centre and enough whole rings around it for `count` cells: the first
 * place is the centre, then ring one clockwise, then ring two, and so on.
 * The places past `count` are the ring's empty cells.
 */
export function ringPlaces(count: number): HivePlace[] {
  const rings = ringsFor(count);
  const around: [number, number][] = [];
  for (let k = 1; k <= rings; k++) around.push(...ringAxial(k));
  return shifted([axial(0, 0), ...around.map(([q, r]) => axial(q, r))]);
}

/**
 * Week rows: seven boxes to a row, one row per week, every other row half
 * a box to the right. Place `i` is day `i % 7` of week `floor(i / 7)`.
 */
export function weekRowPlaces(weeks: number): HivePlace[] {
  return Array.from({ length: Math.max(0, weeks) * 7 }, (_, i) => {
    const row = Math.floor(i / 7);
    const col = i % 7;
    return { x: round(col + (row % 2 ? 0.5 : 0)), y: row };
  });
}

/** One row of `count` boxes side by side: a week strip. */
export function stripPlaces(count: number): HivePlace[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => ({ x: i, y: 0 }));
}

/**
 * The comb in the shape on screen, in cell widths: the step between rows, a
 * box's height, and the size of the whole comb (what the places span, plus
 * one box). The boxes touch, so the gap is none.
 */
export function boardLayout(places: readonly HivePlace[], shape: HexShape): CombLayout {
  return combLayout(shape, places, 0);
}

/** How much of a plan is done, 0 to 1; null when nothing was due. */
export function planFill(completed: number, due: number): number | null {
  if (due <= 0) return null;
  return Math.max(0, Math.min(1, completed / due));
}

/**
 * A person's colours, as `mh-hex-avatar` reads them. The base tone reads the
 * slot's tile extension first (navy lifts on the dark card); `wash` is the
 * pale fill with its own ink, the tone a tile takes when it repeats.
 *
 * Inside a cell's honey band a person is drawn in their wash: one of the
 * avatar tones is honey itself, and a solid honey avatar in an empty band
 * read as a client whose plan was done. Only the band is solid honey.
 */
export function avatarFill(tone: string, wash = false): string {
  return wash
    ? `var(--ion-color-${tone}-wash)`
    : `var(--ion-color-${tone}-tile, var(--ion-color-${tone}))`;
}

export function avatarInk(tone: string, wash = false): string {
  return wash
    ? `var(--ion-color-${tone}-wash-contrast)`
    : `var(--ion-color-${tone}-tile-contrast, var(--ion-color-${tone}-contrast))`;
}

/**
 * The day a workout timeline row counts for (`kind: 'all'` lists, the
 * trainee's and a coach's read of a client). A finished workout counts when
 * it ended, in the reader's own day, as Home's week does; a skipped plan
 * day sits at noon UTC on its own date (the API's rule), so its date is
 * read as written.
 */
export function timelineDayKey(
  log: Pick<WorkoutLog, 'status' | 'startedAt' | 'completedAt'>,
): string {
  if (log.status === WorkoutLogStatus.Skipped) return log.startedAt.slice(0, 10);
  return localDayKey(new Date(log.completedAt ?? log.startedAt));
}
