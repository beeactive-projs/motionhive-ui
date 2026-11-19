import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ActiveRest,
  ActiveSession,
  ActiveSessionStore,
  LiveStep,
} from '../../_services/active-session.store';
import { HexMeterPhases } from '../hex-meter/hex-meter';
import { ActiveWorkoutBar } from './active-workout-bar';

const NOW = Date.parse('2026-11-19T10:00:00Z');
const LINE = 'Set 3 · 62.5 kg × 8 · Bench press';

const SESSION: ActiveSession = {
  id: 'wl-1',
  name: 'Push day',
  startedAt: '2026-11-19T09:37:00Z',
  pausedAt: null,
  pausedSeconds: 0,
};

/** The set to do next, as the logger hands it on. */
const STEP = { exercise: 'Bench press', set: 'Set 3', total: 4, line: LINE } as LiveStep;
/** The same in a superset: its round, of how many. */
const ROUND = { exercise: 'Bench press', set: 'Round 2', total: 3, round: 2, line: LINE } as LiveStep;

/** A 90 s rest ending `endsIn` seconds from now. */
const rest = (endsIn: number): ActiveRest => ({
  logId: 'wl-1',
  exerciseId: 'e-1',
  setId: 's-3',
  startedAt: NOW - (90 - endsIn) * 1000,
  endsAt: NOW + endsIn * 1000,
  planned: 90,
  next: LINE,
});

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  TestBed.resetTestingModule();
  vi.useRealTimers();
});

/**
 * The bar over a stubbed store, its template blanked, at `NOW`. Keys come
 * back with their params, so a line reads `key(param|param)`.
 */
function setup(state: {
  session?: ActiveSession;
  rest?: ActiveRest | null;
  allDone?: boolean;
  steps?: LiveStep[];
  next?: string;
}) {
  vi.useFakeTimers({ now: NOW });
  const store: {
    session: WritableSignal<ActiveSession | null>;
    rest: WritableSignal<ActiveRest | null>;
    allDone: WritableSignal<boolean>;
    liveSteps: WritableSignal<readonly LiveStep[]>;
    next: WritableSignal<string>;
    now: WritableSignal<number>;
  } = {
    now: signal(NOW),
    session: signal(state.session ?? SESSION),
    rest: signal(state.rest ?? null),
    allDone: signal(state.allDone ?? false),
    liveSteps: signal(state.steps ?? []),
    next: signal(state.next ?? ''),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: ActiveSessionStore, useValue: store },
      { provide: Router, useValue: { navigate: vi.fn(() => Promise.resolve(true)) } },
      {
        provide: TranslateService,
        useValue: {
          instant: (key: string, params?: Record<string, unknown>) =>
            params ? `${key}(${Object.values(params).join('|')})` : key,
        },
      },
    ],
  });
  TestBed.overrideComponent(ActiveWorkoutBar, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(ActiveWorkoutBar);
  destroy = () => fixture.destroy();
  storeNow = store.now;
  return fixture.componentInstance;
}

/** The store's clock in the last `setup`, which a spec moves on by hand. */
let storeNow: WritableSignal<number>;

const NEXT_SET = 'workouts.activeBar.nextSet(Bench press|Set 3)';

describe('ActiveWorkoutBar', () => {
  // The clock is the figure on the right, so the title never repeats it.
  it('says what comes next between sets, beside the workout clock', () => {
    const bar = setup({ steps: [STEP] });
    expect(bar.meterPhase()).toBe(HexMeterPhases.Workout);
    expect(bar.icon()).toBe('barbell-outline');
    expect(bar.title()).toBe('Push day');
    expect(bar.sub()).toBe(NEXT_SET);
    expect(bar.right()).toBe('23:00');
  });

  it('keeps the name alone in the title while a rest counts too', () => {
    expect(setup({ steps: [STEP], rest: rest(62) }).title()).toBe('Push day');
  });

  it('says the workout is in progress when nothing is known to come', () => {
    expect(setup({}).sub()).toBe('workouts.activeBar.inProgress');
  });

  it('counts a rest down under what comes next', () => {
    const bar = setup({ steps: [STEP], rest: rest(62) });
    expect(bar.meterPhase()).toBe(HexMeterPhases.Rest);
    expect(bar.sub()).toBe(NEXT_SET);
    expect(bar.right()).toBe('1:02');
    expect(bar.left()).toBeCloseTo(62 / 90);
  });

  it('names the round in a superset', () => {
    const bar = setup({ steps: [ROUND], rest: rest(45) });
    expect(bar.sub()).toBe('workouts.activeBar.nextRound(2|3)');
  });

  it('falls back on the whole line kept with the rest when no step is known', () => {
    expect(setup({ rest: rest(45) }).sub()).toBe(`workouts.live.next(${LINE})`);
  });

  it('says the rest is over, with no number until there is overtime to count', () => {
    const over = setup({ steps: [STEP], rest: rest(0) });
    expect(over.meterPhase()).toBe(HexMeterPhases.Over);
    expect(over.sub()).toBe(`workouts.activeBar.restOver(${NEXT_SET})`);
    expect(over.right()).toBe('');
    destroy?.();
    TestBed.resetTestingModule();

    // "+0:25" alone, as the rest timer says it: the line already says "Rest over".
    const overtime = setup({ steps: [STEP], rest: rest(-25) });
    expect(overtime.right()).toBe('+0:25');
    expect(overtime.over()).toBe(true);
    expect(overtime.paused()).toBe(false);
  });

  it('says only "Rest over" when nothing is known to come', () => {
    expect(setup({ rest: { ...rest(-5), next: '' } }).sub()).toBe('workouts.restTimer.restOver');
  });

  it('stands still while paused, in the muted ink', () => {
    const bar = setup({ session: { ...SESSION, pausedAt: '2026-11-19T09:50:00Z' }, steps: [STEP] });
    expect(bar.meterPhase()).toBe(HexMeterPhases.Paused);
    expect(bar.paused()).toBe(true);
    expect(bar.sub()).toBe('workouts.activeBar.paused');
    expect(bar.right()).toBe('13:00');
  });

  it('shows the trophy once every set is ticked, with the workout clock', () => {
    const bar = setup({ allDone: true });
    expect(bar.meterPhase()).toBe(HexMeterPhases.Done);
    expect(bar.icon()).toBe('trophy-outline');
    expect(bar.sub()).toBe('workouts.live.allDone');
    expect(bar.right()).toBe('23:00');
  });

  /**
   * The one line a screen reader reads of the bar, so it says it all. It was
   * "Back to Push day" alone: the rest, the time and what is next were never
   * read out.
   */
  describe('its name for a screen reader', () => {
    it('says how the rest stands and what comes next', () => {
      expect(setup({ steps: [STEP], rest: rest(62) }).label()).toBe(
        `workouts.activeBar.openStatusNext(Push day|workouts.home.resting(1:02|1:30)|${NEXT_SET})`,
      );
    });

    it('says the rest is over, and by how much', () => {
      expect(setup({ steps: [STEP], rest: rest(-25) }).label()).toBe(
        `workouts.activeBar.openStatusNext(Push day|workouts.home.restOvertime(+0:25)|${NEXT_SET})`,
      );
    });

    it('says the workout clock between sets', () => {
      expect(setup({}).label()).toBe(
        'workouts.activeBar.openStatus(Push day|workouts.home.workout(23:00))',
      );
    });

    // The line under the name says no next then either.
    it('says paused with its clock, and nothing of what comes next', () => {
      const paused = { ...SESSION, pausedAt: '2026-11-19T09:50:00Z' };
      expect(setup({ session: paused, steps: [STEP] }).label()).toBe(
        'workouts.activeBar.openStatus(Push day|workouts.home.paused(13:00))',
      );
    });

    it('says every set is done', () => {
      expect(setup({ allDone: true, steps: [STEP] }).label()).toBe(
        'workouts.activeBar.openStatus(Push day|workouts.home.allDone(23:00))',
      );
    });
  });

  // The resume card counts from the same clock, so the two agree to the second.
  it('counts from the store’s clock, not one of its own', () => {
    const bar = setup({ steps: [STEP], rest: rest(62) });
    vi.advanceTimersByTime(5_000);
    expect(bar.right()).toBe('1:02');

    storeNow.set(NOW + 2_000);
    expect(bar.right()).toBe('1:00');
  });
});
