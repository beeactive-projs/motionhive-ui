import { describe, expect, it } from 'vitest';

import { translate } from 'core';

import { RestLiveState } from '../../../_shared/native/rest-live';
import { liveState } from '../../workouts/_services/lock-screen.config';
import {
  DotStates,
  LivePhases,
  PREVIEW_LOG_ID,
  PreviewMock,
  PreviewScenario,
  PreviewScenarios,
  androidLiveFace,
  chronometer,
  liveClock,
  liveFace,
  livePhase,
  nudgedRest,
  parsePreviewNumber,
  previewMock,
  previewWorld,
} from './workout-status.config';

const NOW = Date.UTC(2026, 10, 18, 9, 0, 0);

function world(scenario: PreviewScenario, patch: Partial<PreviewMock> = {}) {
  return previewWorld({ ...previewMock(scenario, translate), ...patch }, NOW, translate);
}

/** What the app would hand the phone for a preset, at `NOW`. */
function live(scenario: PreviewScenario, patch: Partial<PreviewMock> = {}): RestLiveState {
  const { session, rest, next, steps } = world(scenario, patch);
  return liveState(session, rest, next, translate, NOW, steps);
}

describe('previewMock', () => {
  it('names the workout and the exercise in the reader language', () => {
    const mock = previewMock(PreviewScenarios.BetweenSets, translate);
    expect(mock.name).toBe('Push day');
    expect(mock.exercise).toBe('Bench press');
  });

  it('rests only in the rest presets', () => {
    const resting = (scenario: PreviewScenario) => previewMock(scenario, translate).resting;
    expect(resting(PreviewScenarios.BetweenSets)).toBe(false);
    expect(resting(PreviewScenarios.Paused)).toBe(false);
    expect(resting(PreviewScenarios.AllDone)).toBe(false);
    expect(resting(PreviewScenarios.Resting)).toBe(true);
    expect(resting(PreviewScenarios.Go)).toBe(true);
    expect(resting(PreviewScenarios.Overtime)).toBe(true);
  });

  it('runs into overtime below zero', () => {
    expect(previewMock(PreviewScenarios.Overtime, translate).restLeft).toBeLessThan(0);
    expect(previewMock(PreviewScenarios.Soon, translate).restLeft).toBeLessThanOrEqual(10);
  });
});

describe('previewWorld', () => {
  it('starts the workout the minutes given before now', () => {
    const { session } = world(PreviewScenarios.BetweenSets, { elapsedMinutes: 23 });
    expect(session.id).toBe(PREVIEW_LOG_ID);
    expect(NOW - new Date(session.startedAt).getTime()).toBe(23 * 60_000);
    expect(session.pausedAt).toBeNull();
  });

  it('pauses it now, so its clock stands at those minutes', () => {
    const { session } = world(PreviewScenarios.Paused);
    expect(session.pausedAt).toBe(new Date(NOW).toISOString());
  });

  it('ends the rest the seconds left from now, begun the planned before that end', () => {
    const { rest } = world(PreviewScenarios.Resting, { restPlanned: 90, restLeft: 60 });
    expect(rest?.endsAt).toBe(NOW + 60_000);
    expect(rest?.startedAt).toBe(NOW - 30_000);
    expect(rest?.planned).toBe(90);
  });

  it('keeps a hidden rest without its end, and no rest while paused', () => {
    expect(world(PreviewScenarios.RestHidden).rest?.endsAt).toBeNull();
    expect(world(PreviewScenarios.Resting, { paused: true }).rest).toBeNull();
  });

  it('says what comes next as the logger would', () => {
    const { next, steps, rest } = world(PreviewScenarios.Resting);
    expect(next).toBe('Set 3 · 62.5 kg × 8 · Bench press');
    expect(rest?.next).toBe(next);
    expect(steps[0]).toMatchObject({
      set: 'Set 3',
      target: '62.5 kg × 8',
      short: '62.5 × 8',
      last: 'last 60 × 8',
      values: { weightKg: 62.5, reps: 8 },
      rest: 90,
    });
  });

  it('lays a superset round out in order', () => {
    const [step] = world(PreviewScenarios.Superset).steps;
    expect(step.set).toBe('Round 2');
    expect(step.kicker).toBe('Superset · round 2 of 3');
    expect(step.order).toBe('A1 Bench press 62.5 × 8 → A2 Push-ups × 15');
  });

  it('has nothing ahead once every set is done', () => {
    const done = world(PreviewScenarios.AllDone);
    expect(done.steps).toEqual([]);
    expect(done.next).toBe('');
  });

  it('leaves the weight out when there is none', () => {
    const [step] = world(PreviewScenarios.BetweenSets, { weight: null, lastWeight: null }).steps;
    expect(step.target).toBe('× 8');
    expect(step.values).toEqual({ reps: 8 });
  });
});

describe('parsePreviewNumber', () => {
  it('reads a number', () => {
    expect(parsePreviewNumber('62.5', false)).toBe(62.5);
    expect(parsePreviewNumber(-25, false)).toBe(-25);
  });

  it('empties only a field that may be empty', () => {
    expect(parsePreviewNumber('', true)).toBeNull();
    expect(parsePreviewNumber(null, true)).toBeNull();
    expect(parsePreviewNumber('', false)).toBeUndefined();
  });

  it('ignores what is no number', () => {
    expect(parsePreviewNumber('-', false)).toBeUndefined();
    expect(parsePreviewNumber('abc', true)).toBeUndefined();
  });
});

describe('nudgedRest', () => {
  const rest = world(PreviewScenarios.Resting, { restLeft: 20 }).rest!;

  it('moves the end by the nudge, never before now', () => {
    expect(nudgedRest(rest, 15, NOW).endsAt).toBe(NOW + 35_000);
    expect(nudgedRest(rest, -15, NOW).endsAt).toBe(NOW + 5_000);
    expect(nudgedRest(rest, -30, NOW).endsAt).toBe(NOW);
  });

  it('leaves a hidden rest alone', () => {
    const hidden = { ...rest, endsAt: null };
    expect(nudgedRest(hidden, 15, NOW)).toBe(hidden);
  });
});

describe('the clocks', () => {
  it('liveClock: minutes, then hours, as the app says them', () => {
    expect(liveClock(65)).toBe('1:05');
    expect(liveClock(3912)).toBe('1:05:12');
    expect(liveClock(-3)).toBe('0:00');
  });

  it('chronometer: two-digit minutes, as Android draws it', () => {
    expect(chronometer(65)).toBe('01:05');
    expect(chronometer(3912)).toBe('1:05:12');
  });
});

describe('livePhase', () => {
  it('is rest, then Go once the end passed, the clock between sets, or paused', () => {
    expect(livePhase(live(PreviewScenarios.Resting), NOW)).toBe(LivePhases.Rest);
    expect(livePhase(live(PreviewScenarios.Overtime), NOW)).toBe(LivePhases.Go);
    expect(livePhase(live(PreviewScenarios.BetweenSets), NOW)).toBe(LivePhases.Workout);
    expect(livePhase(live(PreviewScenarios.Paused), NOW)).toBe(LivePhases.Paused);
  });

  it('turns to Go at zero by itself', () => {
    const state = live(PreviewScenarios.Resting, { restLeft: 5 });
    expect(livePhase(state, NOW + 4_000)).toBe(LivePhases.Rest);
    expect(livePhase(state, NOW + 5_000)).toBe(LivePhases.Go);
  });
});

describe('liveFace', () => {
  it('counts the rest down beside its planned length, the next set after it', () => {
    const face = liveFace(live(PreviewScenarios.Resting, { restPlanned: 90, restLeft: 62 }), NOW);
    expect(face.kicker).toBe('Rest');
    expect(face.big).toBe('1:02');
    expect(face.aside).toBe('of 1:30');
    expect(face.restLeft).toBeCloseTo(62 / 90);
    expect(face.nextLine).toMatchObject({
      lead: 'Next: Bench press',
      set: 'Set 3',
      target: '62.5 kg × 8',
    });
    expect(face.detail).toBe('last 60 × 8');
    expect(face.actions.map((chip) => chip.text)).toEqual(['−15', '+15', 'Skip']);
    expect(face.islandActions.map((chip) => chip.text)).toEqual(['+15', 'Skip']);
  });

  it('says Done and counts past it, with Start set in honey', () => {
    const face = liveFace(live(PreviewScenarios.Overtime, { restLeft: -25 }), NOW);
    expect(face.big).toBe('Done');
    expect(face.over).toBe('+0:25');
    expect(face.compact).toBe('✓');
    expect(face.actions).toEqual([
      { text: 'Start set', primary: true },
      { text: '+30 s', primary: false },
      { text: '✓ 62.5 × 8', primary: false },
    ]);
    // Two fit in the island: +30 s gives way to ✓.
    expect(face.islandActions.map((chip) => chip.text)).toEqual(['Start set', '✓ 62.5 × 8']);
  });

  it('shows the workout clock, the progress and the target between sets', () => {
    const face = liveFace(live(PreviewScenarios.BetweenSets, { elapsedMinutes: 23 }), NOW);
    expect(face.kicker).toBe('Push day · Workout');
    expect(face.big).toBe('23:00');
    expect(face.aside).toBe('7 of 13 sets');
    expect(face.restLeft).toBeNull();
    expect(face.nextLine.target).toBe('');
    expect(face.detail).toBe('Target 62.5 kg × 8 · last 60 × 8');
    expect(face.actions).toEqual([
      { text: '✓ 62.5 × 8', primary: true },
      { text: 'Other value', primary: false },
      { text: 'Skip set', primary: false },
    ]);
    expect(face.islandActions.map((chip) => chip.text)).toEqual(['✓ 62.5 × 8', 'Open']);
  });

  it('stands still while paused, with Continue', () => {
    const face = liveFace(live(PreviewScenarios.Paused, { elapsedMinutes: 23 }), NOW + 60_000);
    expect(face.big).toBe('23:00');
    expect(face.actions).toEqual([{ text: 'Continue', primary: true }]);
  });

  it('lights the sets done in honey and the next one lighter', () => {
    const face = liveFace(live(PreviewScenarios.Resting, { done: 2, total: 4 }), NOW);
    expect(face.dots).toEqual([DotStates.Done, DotStates.Done, DotStates.Next, DotStates.Todo]);
    expect(face.dotsText).toBe('');
  });

  it('counts past eight sets instead of drawing them', () => {
    const face = liveFace(live(PreviewScenarios.Resting, { done: 2, total: 10 }), NOW);
    expect(face.dots).toEqual([]);
    expect(face.dotsText).toBe('3/10');
  });

  it('has no buttons and no line once nothing is left', () => {
    const face = liveFace(live(PreviewScenarios.AllDone), NOW);
    expect(face.actions).toEqual([]);
    expect(face.nextLine.shown).toBe(false);
  });

  it('puts the whole round on the line in a superset, with no last time', () => {
    const face = liveFace(live(PreviewScenarios.Superset), NOW);
    expect(face.kicker).toBe('Superset · round 2 of 3');
    expect(face.nextLine.lead).toBe('Next: A1 Bench press 62.5 × 8 → A2 Push-ups × 15');
    expect(face.detail).toBe('');
  });
});

describe('androidLiveFace', () => {
  it('counts the rest down with +15 s, Skip and Open, the bar under it', () => {
    const state = live(PreviewScenarios.Resting, { restPlanned: 90, restLeft: 45 });
    const face = androidLiveFace(state, NOW);
    expect(face.phase).toBe(LivePhases.Rest);
    expect(face.sub).toBe('Rest');
    expect(face.title).toBe('');
    expect(face.clock).toBe('00:45');
    expect(face.line).toBe('Next: Set 3 · 62.5 kg × 8 · Bench press');
    expect(face.progress).toBeCloseTo(0.5);
    expect(face.actions).toEqual(['+15 s', 'Skip', 'Open']);
  });

  it('says Go with Start set once the rest is over', () => {
    const face = androidLiveFace(live(PreviewScenarios.Overtime), NOW);
    expect(face.title).toBe('Go');
    expect(face.clock).toBe('');
    expect(face.line).toBe('Set 3 · 62.5 kg × 8 · Bench press');
    expect(face.actions).toEqual(['Start set', 'Open']);
  });

  it('runs the workout clock between sets, and stops it while paused', () => {
    const between = androidLiveFace(
      live(PreviewScenarios.BetweenSets, { elapsedMinutes: 23 }),
      NOW,
    );
    expect(between.title).toBe('Push day · ');
    expect(between.clock).toBe('23:00');
    const paused = androidLiveFace(live(PreviewScenarios.Paused, { elapsedMinutes: 23 }), NOW);
    expect(paused.title).toBe('Push day · 23:00');
    expect(paused.line).toBe('Paused');
    expect(paused.actions).toEqual(['Open']);
  });
});
