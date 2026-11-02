import { describe, expect, it } from 'vitest';

import { ExerciseProgress, VolumeUnit, VolumeUnits, WorkoutVolume } from 'core';

import {
  ExerciseMetrics,
  VolumeTrends,
  axisValue,
  barHeights,
  exerciseMetrics,
  exerciseVolumeRows,
  formatPercentChange,
  formatVolume,
  formatVolumeChange,
  formatWeekValue,
  pointsChangePercent,
  recordStillSince,
  topSetPoints,
  topSetUnit,
  volumePoints,
  weekBounds,
  weekSlots,
  workoutComparisonLine,
  WeekMetrics,
} from './volume.config';

type Session = ExerciseProgress['sessions'][number];

/** A local instant, so the day maths read the way the phone does. */
const at = (month: number, day: number, hour = 18) => new Date(2026, month - 1, day, hour).toISOString();
const NOW = new Date(2026, 10, 2, 12).getTime(); // Mon 2 Nov 2026, noon

const session = (performedAt: string, fields: Partial<Session> = {}): Session => ({
  workoutLogId: `log-${performedAt}`,
  performedAt,
  workoutName: 'Push day',
  setCount: 3,
  topWeightKg: 60,
  topReps: 8,
  bestDurationSeconds: null,
  bestDistanceMeters: null,
  volume: 1440,
  volumeUnit: VolumeUnits.Kg,
  ...fields,
});

describe('volume', () => {
  describe('saying a volume', () => {
    it('keeps the unit with the number', () => {
      expect(formatVolume(4280, VolumeUnits.Kg)).toBe('4,280 kg');
      expect(formatVolume(120, VolumeUnits.Reps)).toBe('120 reps');
      expect(formatVolume(1, VolumeUnits.Reps)).toBe('1 rep');
      expect(formatVolume(390, VolumeUnits.Seconds)).toBe('6:30');
      expect(formatVolume(3900, VolumeUnits.Seconds)).toBe('1h 5m');
      expect(formatVolume(5000, VolumeUnits.Meters)).toBe('5,000 m');
    });

    it('signs a change with a real minus', () => {
      expect(formatVolumeChange(340, VolumeUnits.Kg)).toBe('+340 kg');
      expect(formatVolumeChange(-120, VolumeUnits.Kg)).toBe('−120 kg');
      expect(formatVolumeChange(15, VolumeUnits.Seconds)).toBe('+0:15');
      expect(formatPercentChange(9)).toBe('+9%');
      expect(formatPercentChange(-3)).toBe('−3%');
      expect(formatPercentChange(0)).toBe('0%');
    });

    it('writes an axis value short where the axis is narrow', () => {
      expect(axisValue(4281, VolumeUnits.Kg)).toBe('4281');
      expect(axisValue(12_400, VolumeUnits.Kg)).toBe('12.4k');
      expect(axisValue(95, VolumeUnits.Seconds)).toBe('1:35');
      expect(axisValue(81.5, null)).toBe('81.5');
    });
  });

  describe('a finished workout against last time', () => {
    const base: WorkoutVolume = {
      totalKg: 4280,
      previous: {
        workoutLogId: 'wl-0',
        name: 'Push day',
        completedAt: at(10, 21),
        totalKg: 3940,
      },
      changeKg: 340,
      changePercent: 9,
      exercises: [],
    };

    /** The line with its no-break spaces read as spaces. */
    const line = (volume: WorkoutVolume) => workoutComparisonLine(volume)?.replace(/ /g, ' ');

    it('says the change, the last total and the percent', () => {
      // No-break spaces keep each figure whole on its line.
      expect(workoutComparisonLine(base)).toBe('+340 kg vs last Push day (3,940 kg) · +9%');
      expect(line({ ...base, totalKg: 3820, changeKg: -120, changePercent: -3 })).toBe(
        '−120 kg vs last Push day (3,940 kg) · −3%',
      );
      expect(line({ ...base, totalKg: 3940, changeKg: 0, changePercent: 0 })).toBe(
        'Same as last Push day (3,940 kg)',
      );
    });

    it('leaves out a percent of nothing', () => {
      const bodyweightLastTime = {
        ...base,
        totalKg: 400,
        previous: { ...base.previous!, totalKg: 0 },
        changeKg: 400,
        changePercent: null,
      };
      expect(line(bodyweightLastTime)).toBe('+400 kg vs last Push day (0 kg)');
    });

    it('promises the comparison the first time', () => {
      const first = { ...base, previous: null, changeKg: null, changePercent: null };
      expect(workoutComparisonLine(first)).toBe("Next time you'll see the comparison here.");
      // Freestyle with an exercise done before: its row says it instead.
      const freestyle = {
        ...first,
        exercises: [
          {
            exerciseId: 'bench',
            loggedExerciseId: 'le-1',
            unit: VolumeUnits.Kg,
            volume: 1460,
            previous: { workoutLogId: 'wl-x', performedAt: at(10, 21), volume: 1280 },
            changePercent: 14,
          },
        ],
      };
      expect(workoutComparisonLine(freestyle)).toBeNull();
    });

    it('groups a superset under its letter, with each member tagged', () => {
      const entry = (id: string, unit: VolumeUnit) => ({
        exerciseId: id,
        loggedExerciseId: id,
        unit,
        volume: 100,
        previous: { workoutLogId: 'wl-0', performedAt: at(10, 21), volume: 90 },
        changePercent: 11,
      });
      const rows = exerciseVolumeRows(
        { ...base, exercises: [entry('incline', VolumeUnits.Kg), entry('pushup', VolumeUnits.Reps), entry('fly', VolumeUnits.Kg)] },
        (id) => id,
        (id) => ({ incline: 'A1', pushup: 'A2' })[id] ?? null,
      );
      expect(rows.map((r) => [r.tag, r.group])).toEqual([
        ['A1', 'Superset A'],
        ['A2', null],
        [null, null],
      ]);
    });

    it('draws each exercise on its own unit’s scale', () => {
      const rows = exerciseVolumeRows(
        {
          ...base,
          exercises: [
            {
              exerciseId: 'bench',
              loggedExerciseId: 'le-bench',
              unit: VolumeUnits.Kg,
              volume: 2000,
              previous: { workoutLogId: 'wl-0', performedAt: at(10, 21), volume: 1760 },
              changePercent: 14,
            },
            {
              exerciseId: 'fly',
              loggedExerciseId: 'le-fly',
              unit: VolumeUnits.Kg,
              volume: 800,
              previous: { workoutLogId: 'wl-0', performedAt: at(10, 21), volume: 870 },
              changePercent: -8,
            },
            {
              exerciseId: 'pushup',
              loggedExerciseId: 'le-pushup',
              unit: VolumeUnits.Reps,
              volume: 40,
              previous: null,
              changePercent: null,
            },
          ],
        },
        (id) => ({ 'le-bench': 'Bench press', 'le-fly': 'Cable fly', 'le-pushup': 'Push-up' })[id] ?? '',
      );

      expect(rows.map((r) => [r.name, r.todayWidth, r.lastWidth, r.change, r.trend])).toEqual([
        ['Bench press', 100, 88, '+14%', VolumeTrends.Up],
        ['Cable fly', 40, 44, '−8%', VolumeTrends.Down],
        // Reps are not drawn against kilograms: its own scale, alone.
        ['Push-up', 100, null, 'First time', null],
      ]);
      expect(rows[0].label).toBe('Bench press: 2,000 kg today, 1,760 kg last time');
      expect(rows[2].label).toBe('Push-up: 40 reps today, the first time');
    });
  });

  describe("an exercise's page", () => {
    const progress = (sessions: Session[], records: string[] = []): ExerciseProgress => ({
      exercise: { id: 'bench', name: 'Bench press', slug: 'bench', kind: 'STRENGTH', thumbnailUrl: null },
      oneRepMaxSeries: records.map((recordedAt) => ({
        weightKg: 80,
        recordedAt,
        source: 'ESTIMATED_EPLEY',
      })),
      sessions,
    });

    it('offers the metrics the exercise has', () => {
      expect(exerciseMetrics(progress([session(at(10, 28))], [at(10, 28)]))).toEqual([
        ExerciseMetrics.OneRepMax,
        ExerciseMetrics.TopSet,
        ExerciseMetrics.Volume,
      ]);
      // A plank: no estimate, a best hold and a total time.
      const plank = session(at(10, 28), {
        topWeightKg: null,
        topReps: null,
        bestDurationSeconds: 60,
        volume: 150,
        volumeUnit: VolumeUnits.Seconds,
      });
      expect(exerciseMetrics(progress([plank]))).toEqual([ExerciseMetrics.TopSet, ExerciseMetrics.Volume]);
      expect(topSetUnit([plank])).toBe(VolumeUnits.Seconds);
      // An older API sends no volume.
      expect(exerciseMetrics(progress([session(at(10, 28), { volume: undefined })]))).toEqual([
        ExerciseMetrics.TopSet,
      ]);
    });

    it('draws a session a point, a day of two as one', () => {
      const sessions = [
        session(at(10, 28, 19), { topWeightKg: 62.5, volume: 1000 }),
        session(at(10, 28, 8), { topWeightKg: 60, volume: 500 }),
        session(at(10, 21), { topWeightKg: 60, volume: 1440 }),
        session(at(7, 1), { topWeightKg: 50, volume: 900 }), // before 12 weeks
      ];
      expect(volumePoints(sessions, '12w', NOW).map((p) => p.y)).toEqual([1440, 1500]);
      expect(topSetPoints(sessions, VolumeUnits.Kg, '12w', NOW).map((p) => p.y)).toEqual([60, 62.5]);
      expect(pointsChangePercent(volumePoints(sessions, '12w', NOW))).toBe(4);
      expect(pointsChangePercent(volumePoints(sessions, '4w', NOW).slice(0, 1))).toBeNull();
    });

    describe('progress without a record', () => {
      // Newest first, as the API sends them: the same 60 kg, one more set.
      const sameWeightMoreWork = [
        session(at(10, 28), { topWeightKg: 60, volume: 1920, setCount: 4 }),
        session(at(10, 14), { topWeightKg: 60, volume: 1440 }),
      ];

      it('says it when the record held and the work grew at the same weight', () => {
        const record = at(8, 30);
        expect(recordStillSince(progress(sameWeightMoreWork, [record]), '4w', NOW)).toBe(record);
      });

      it('stays quiet when the record moved inside the range', () => {
        expect(recordStillSince(progress(sameWeightMoreWork, [at(10, 20)]), '4w', NOW)).toBeNull();
      });

      it('stays quiet when the weight changed or the work did not grow', () => {
        const heavier = [
          session(at(10, 28), { topWeightKg: 62.5, volume: 1920 }),
          session(at(10, 14), { topWeightKg: 60, volume: 1440 }),
        ];
        const less = [
          session(at(10, 28), { topWeightKg: 60, volume: 1200 }),
          session(at(10, 14), { topWeightKg: 60, volume: 1440 }),
        ];
        expect(recordStillSince(progress(heavier, [at(8, 30)]), '4w', NOW)).toBeNull();
        expect(recordStillSince(progress(less, [at(8, 30)]), '4w', NOW)).toBeNull();
      });

      it('never speaks of a record that does not exist', () => {
        expect(recordStillSince(progress(sameWeightMoreWork, []), '4w', NOW)).toBeNull();
        expect(recordStillSince(progress(sameWeightMoreWork.slice(0, 1), [at(8, 30)]), '4w', NOW)).toBeNull();
      });
    });
  });

  describe('Progress: the last twelve weeks', () => {
    it('fills the weeks without a workout and ends on this one', () => {
      const slots = weekSlots(
        [
          { weekStart: '2026-10-19', volumeKg: 8000, workouts: 2, minutes: 95 },
          { weekStart: '2026-11-02', volumeKg: 4280, workouts: 1, minutes: 48 },
        ],
        NOW,
      );
      expect(slots).toHaveLength(12);
      expect(slots[0].key).toBe('2026-08-17');
      expect(slots.at(-1)).toEqual({ key: '2026-11-02', workouts: 1, volumeKg: 4280, minutes: 48 });
      expect(slots.at(-2)).toEqual({ key: '2026-10-26', workouts: 0, volumeKg: 0, minutes: 0 });
      expect(slots.at(-3)?.workouts).toBe(2);
    });

    it('reads a week the way its chip asks', () => {
      expect(formatWeekValue(3, WeekMetrics.Workouts)).toBe('3 workouts');
      expect(formatWeekValue(11_240, WeekMetrics.Volume)).toBe('11,240 kg');
      expect(formatWeekValue(146, WeekMetrics.Time)).toBe('2h 26m');
    });

    it('draws bars to the tallest week, an empty week as nothing', () => {
      expect(barHeights([0, 50, 100, 1])).toEqual([0, 50, 100, 4]);
      expect(barHeights([0, 0])).toEqual([0, 0]);
    });

    it('bounds a week from its Monday to the next, as History asks', () => {
      expect(weekBounds('2026-10-26')).toEqual({
        dateFrom: new Date(2026, 9, 26).toISOString(),
        dateTo: new Date(2026, 10, 2).toISOString(),
      });
    });
  });
});
