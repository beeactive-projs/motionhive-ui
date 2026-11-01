import { describe, expect, it } from 'vitest';

import {
  DURATION_MAX_SECONDS,
  DURATION_MIN_SECONDS,
  HOUR_CHOICES,
  MINUTE_CHOICES,
  durationWords,
  joinDuration,
  minuteAllowed,
  recordedSeconds,
  settleWheels,
  splitDuration,
} from './adjust-duration.config';

describe('adjust duration', () => {
  it('keeps to the API’s bounds: a minute to six hours', () => {
    expect(DURATION_MIN_SECONDS).toBe(60);
    expect(DURATION_MAX_SECONDS).toBe(21_600);
    expect(HOUR_CHOICES).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(MINUTE_CHOICES).toHaveLength(60);
  });

  it('puts a length on the wheels to the nearest minute', () => {
    expect(splitDuration(3120)).toEqual({ hours: 0, minutes: 52 });
    expect(splitDuration(4320)).toEqual({ hours: 1, minutes: 12 });
    expect(splitDuration(4349)).toEqual({ hours: 1, minutes: 12 });
    expect(splitDuration(4350)).toEqual({ hours: 1, minutes: 13 });
    expect(splitDuration(null)).toEqual({ hours: 0, minutes: 1 });
    expect(splitDuration(30_000)).toEqual({ hours: 6, minutes: 0 });
  });

  it('turns the wheels back into seconds, within bounds', () => {
    expect(joinDuration(1, 12)).toBe(4320);
    expect(joinDuration(0, 0)).toBe(60);
    expect(joinDuration(6, 30)).toBe(21_600);
  });

  it('stops the minutes at zero on six hours and never allows nothing', () => {
    expect(minuteAllowed(6, 0)).toBe(true);
    expect(minuteAllowed(6, 1)).toBe(false);
    expect(minuteAllowed(0, 0)).toBe(false);
    expect(minuteAllowed(0, 1)).toBe(true);
    expect(minuteAllowed(5, 59)).toBe(true);
  });

  it('snaps an impossible pick back to the nearest length a workout can have', () => {
    expect(settleWheels(6, 30)).toEqual({ hours: 6, minutes: 0 });
    expect(settleWheels(0, 0)).toEqual({ hours: 0, minutes: 1 });
    expect(settleWheels(1, 12)).toEqual({ hours: 1, minutes: 12 });
    expect(settleWheels(6, 0)).toEqual({ hours: 6, minutes: 0 });
  });

  it('works out what the clock recorded, pauses out, unknown past six hours', () => {
    const at = (hours: number, minutes: number) =>
      new Date(2026, 9, 28, hours, minutes).toISOString();
    expect(
      recordedSeconds({ startedAt: at(18, 20), completedAt: at(19, 12), pausedSeconds: 0 }),
    ).toBe(3120);
    expect(
      recordedSeconds({ startedAt: at(18, 20), completedAt: at(19, 12), pausedSeconds: 300 }),
    ).toBe(2820);
    expect(
      recordedSeconds({ startedAt: at(8, 0), completedAt: at(15, 0), pausedSeconds: 0 }),
    ).toBeNull();
    expect(
      recordedSeconds({ startedAt: at(8, 0), completedAt: null, pausedSeconds: 0 }),
    ).toBeNull();
  });

  it('says a length the way the app says it everywhere', () => {
    expect(durationWords(3120)).toBe('52m');
    expect(durationWords(4320)).toBe('1h 12m');
    expect(durationWords(20)).toBe('1m');
  });
});
