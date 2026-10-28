import { describe, expect, it } from 'vitest';

import { WorkoutLog, translate } from 'core';

import { CAPTION_MAX_LENGTH, ShareCardOptions, shareCardContent } from './share-card';

const t = (key: string, params?: Record<string, unknown>) => translate(key, params);

function log(over: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: 'wl-1',
    name: 'Leg day',
    completedAt: '2026-10-22T16:47:00Z',
    durationSeconds: 3134,
    exercises: [
      {
        sets: [
          { id: 's1', isCompleted: true, weightKg: 100, reps: 5, durationSeconds: null, distanceMeters: null },
          { id: 's2', isCompleted: true, weightKg: 100, reps: 5, durationSeconds: null, distanceMeters: null },
        ],
      },
    ],
    personalRecords: [
      { id: 'pr', exerciseId: 'squat', exerciseName: 'Squat', weightKg: 116.7, deltaKg: 5, setWeightKg: 100, setReps: 5 },
    ],
    summary: { workoutNumber: 12, streakWeeks: 3, previousVolumeKg: null, coachName: 'Bogdan Daniel' },
    ...over,
  } as unknown as WorkoutLog;
}

const options = (over: Partial<ShareCardOptions> = {}): ShareCardOptions => ({
  showKg: true,
  showRecord: true,
  showCoach: false,
  caption: '',
  ...over,
});

describe('shareCardContent — what the card says', () => {
  it('shows the session the way the summary does', () => {
    const card = shareCardContent(log(), options(), t, 'en-GB');
    expect(card.kicker).toBe('WORKOUT #12 · THU 22 OCT');
    expect(card.title).toBe('Leg day');
    expect(card.stats.map((s) => s.value)).toEqual(['52:14', '2', '1000 kg']);
    expect(card.record).toBe('Record · Squat 100 kg × 5');
    expect(card.streak).toBe('3 weeks in a row');
    expect(card.site).toBe('motionhive.fit');
  });

  it('leaves out every kilogram when weights stay private', () => {
    const card = shareCardContent(log(), options({ showKg: false }), t, 'en-GB');
    expect(card.stats.map((s) => s.value).join(' ')).not.toContain('kg');
    // The record still says what was beaten, not by how much.
    expect(card.record).toBe('Record · Squat');
  });

  it('names a coach only when the person chose to', () => {
    expect(shareCardContent(log(), options(), t, 'en-GB').coach).toBeNull();
    expect(shareCardContent(log(), options({ showCoach: true }), t, 'en-GB').coach).toBe(
      'Program by Bogdan Daniel',
    );
    const ownTraining = log({ summary: { workoutNumber: 3, streakWeeks: 0, previousVolumeKg: null, coachName: null } });
    expect(shareCardContent(ownTraining, options({ showCoach: true }), t, 'en-GB').coach).toBeNull();
  });

  it('keeps the message to one line that fits', () => {
    const card = shareCardContent(log(), options({ caption: '  First 100!\n  The knee held.  ' }), t, 'en-GB');
    expect(card.caption).toBe('First 100! The knee held.');
    const long = shareCardContent(log(), options({ caption: 'x'.repeat(120) }), t, 'en-GB');
    expect(long.caption).toHaveLength(CAPTION_MAX_LENGTH);
    expect(shareCardContent(log(), options({ caption: '   ' }), t, 'en-GB').caption).toBeNull();
  });

  it('says nothing about a streak, a record or a number that is not there', () => {
    const quiet = log({
      personalRecords: [],
      summary: { workoutNumber: 0, streakWeeks: 1, previousVolumeKg: null, coachName: null },
    });
    const card = shareCardContent(quiet, options(), t, 'en-GB');
    expect(card.record).toBeNull();
    expect(card.streak).toBeNull();
    expect(card.kicker).toBe('THU 22 OCT');
  });
});
