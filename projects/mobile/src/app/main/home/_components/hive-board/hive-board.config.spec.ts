import { describe, expect, it } from 'vitest';

import { WorkoutLogStatus } from 'core';

import { HEX_HEIGHT } from '../../home.config';
import {
  BoardLooks,
  ROW_STEP,
  avatarFill,
  avatarInk,
  boardCell,
  boardSize,
  planFill,
  ringAxial,
  ringPlaces,
  ringsFor,
  stripPlaces,
  timelineDayKey,
  weekRowPlaces,
} from './hive-board.config';

describe('ringAxial', () => {
  // The Home hive's two rings, in its order: the board walks rings the same
  // way, so a client keeps their place between the card and the page.
  it('walks ring one and ring two as the Home hive lists them', () => {
    expect(ringAxial(1)).toEqual([
      [0, -1],
      [1, -1],
      [1, 0],
      [0, 1],
      [-1, 1],
      [-1, 0],
    ]);
    expect(ringAxial(2)).toEqual([
      [0, -2],
      [1, -2],
      [2, -2],
      [2, -1],
      [2, 0],
      [1, 1],
      [0, 2],
      [-1, 2],
      [-2, 2],
      [-2, 1],
      [-2, 0],
      [-1, -1],
    ]);
  });

  it('holds six cells per step out, and none at the centre', () => {
    expect(ringAxial(0)).toEqual([]);
    expect(ringAxial(3)).toHaveLength(18);
    expect(new Set(ringAxial(3).map(String)).size).toBe(18);
  });
});

describe('ringsFor', () => {
  it('takes as many whole rings as the people need, one at least', () => {
    expect(ringsFor(0)).toBe(1);
    expect(ringsFor(6)).toBe(1);
    expect(ringsFor(7)).toBe(2);
    expect(ringsFor(18)).toBe(2);
    expect(ringsFor(19)).toBe(3);
    expect(ringsFor(36)).toBe(3);
    expect(ringsFor(37)).toBe(4);
  });
});

describe('ringPlaces', () => {
  it('places the centre first, then every cell of the rings, from 0, 0', () => {
    const one = ringPlaces(3);
    expect(one).toHaveLength(7);
    expect(Math.min(...one.map((p) => p.x))).toBe(0);
    expect(Math.min(...one.map((p) => p.y))).toBe(0);
    // The centre sits in the middle row, one box in.
    expect(one[0]).toEqual({ x: 1, y: ROW_STEP });
    expect(ringPlaces(7)).toHaveLength(19);
    expect(ringPlaces(20)).toHaveLength(37);
  });

  // No spacing: neighbours in a row are exactly one box apart, so every box
  // is as wide as the comb allows.
  it('lays the boxes edge to edge', () => {
    const places = ringPlaces(6);
    const row = places.filter((p) => p.y === places[0]!.y).map((p) => p.x);
    expect(row.sort()).toEqual([0, 1, 2]);
  });
});

describe('weekRowPlaces', () => {
  it('puts seven days to a row, every other row half a box to the right', () => {
    const places = weekRowPlaces(2);
    expect(places).toHaveLength(14);
    expect(places[0]).toEqual({ x: 0, y: 0 });
    expect(places[6]).toEqual({ x: 6, y: 0 });
    expect(places[7]).toEqual({ x: 0.5, y: ROW_STEP });
    expect(places[13]).toEqual({ x: 6.5, y: ROW_STEP });
  });
});

describe('stripPlaces', () => {
  it('lines the cells up in one row', () => {
    expect(stripPlaces(3)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });
});

describe('boardSize', () => {
  it('spans the places plus one box', () => {
    expect(boardSize(weekRowPlaces(5))).toEqual({
      width: 7.5,
      height: Math.round((4 * ROW_STEP + HEX_HEIGHT) * 1000) / 1000,
    });
    expect(boardSize(stripPlaces(7))).toEqual({ width: 7, height: HEX_HEIGHT });
    expect(boardSize([])).toEqual({ width: 0, height: 0 });
  });
});

describe('planFill', () => {
  it('is the share of the plan done, capped at a full cell', () => {
    expect(planFill(2, 4)).toBe(0.5);
    expect(planFill(5, 4)).toBe(1);
    expect(planFill(0, 3)).toBe(0);
  });

  // Nothing due is not 0%: the cell gets its own look instead of an empty track.
  it('is null when nothing was due', () => {
    expect(planFill(2, 0)).toBeNull();
  });
});

describe('avatar colours', () => {
  it('read the tile extension first, as mh-hex-avatar does', () => {
    expect(avatarFill('secondary')).toBe(
      'var(--ion-color-secondary-tile, var(--ion-color-secondary))',
    );
    expect(avatarInk('teal')).toBe(
      'var(--ion-color-teal-tile-contrast, var(--ion-color-teal-contrast))',
    );
  });

  // Inside a honey band only the band is solid honey: a honey avatar is pale.
  it('take the wash pair inside a band', () => {
    expect(avatarFill('primary', true)).toBe('var(--ion-color-primary-wash)');
    expect(avatarInk('primary', true)).toBe('var(--ion-color-primary-wash-contrast)');
  });
});

describe('boardCell', () => {
  it('starts empty and takes what it is given', () => {
    const cell = boardCell({ x: 1, y: 2 }, 'k', BoardLooks.Solid, { fill: 1, label: '7' });
    expect(cell).toMatchObject({ x: 1, y: 2, key: 'k', look: 'solid', fill: 1, label: '7' });
    expect(cell.name).toBeNull();
    expect(cell.dot).toBe(false);
  });
});

describe('timelineDayKey', () => {
  it('counts a finished workout on the local day it ended', () => {
    const ended = new Date(2026, 9, 7, 23, 30);
    expect(
      timelineDayKey({
        status: WorkoutLogStatus.Completed,
        startedAt: new Date(2026, 9, 7, 22, 0).toISOString(),
        completedAt: ended.toISOString(),
      }),
    ).toBe('2026-10-07');
  });

  // The API puts a skipped plan day at noon UTC on its date.
  it('reads a skipped plan day by the date it carries', () => {
    expect(
      timelineDayKey({
        status: WorkoutLogStatus.Skipped,
        startedAt: '2026-10-30T12:00:00.000Z',
        completedAt: null,
      }),
    ).toBe('2026-10-30');
  });
});
