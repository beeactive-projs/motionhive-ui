import { describe, expect, it } from 'vitest';

import { ExerciseSetType } from 'core';

import { SetFormValue, setEditPayload } from './set-form-dialog';

const kg: SetFormValue = {
  setType: ExerciseSetType.Normal,
  repsMin: 8,
  repsMax: 8,
  weightKg: 60,
  restSeconds: 90,
  notes: '',
  weightPercent1rm: null,
  durationSeconds: null,
  distanceMeters: null,
  rpe: null,
  rir: null,
  tempo: '',
};

describe('setEditPayload', () => {
  it('sends an emptied field as null, so the edit clears it', () => {
    const payload = setEditPayload({ ...kg, weightKg: null, weightPercent1rm: 75 });
    expect(payload.targetWeightKg).toBeNull();
    expect(payload.targetWeightPercent1rm).toBe(75);
  });

  it('sends empty text as null and trims the rest', () => {
    const payload = setEditPayload({ ...kg, notes: '  slow down  ', tempo: '   ' });
    expect(payload.notes).toBe('slow down');
    expect(payload.tempo).toBeNull();
  });

  it('keeps every value that is there', () => {
    expect(setEditPayload(kg)).toMatchObject({
      setType: ExerciseSetType.Normal,
      targetRepsMin: 8,
      targetRepsMax: 8,
      targetWeightKg: 60,
      restAfterSeconds: 90,
    });
  });
});
