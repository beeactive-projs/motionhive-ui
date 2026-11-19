import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkoutLog, WorkoutLogService } from 'core';

import { ClockService } from '../../_shared/services/clock.service';
import { FeedbackService } from '../../_shared/services/feedback.service';
import { ExercisesStore } from '../exercises/exercises.store';
import { HexMeterPhases } from './_components/hex-meter/hex-meter';
import {
  ActiveRest,
  ActiveSession,
  ActiveSessionStore,
  SetProgress,
} from './_services/active-session.store';
import { ActiveWorkoutService } from './_services/active-workout.service';
import { ResumeCardService } from './_services/resume-card.service';
import { RoutineActionsService } from './_services/routine-actions.service';
import { HistoryStore } from './history/history.store';
import { Workouts } from './workouts';
import { WorkoutTabs } from './workouts.config';
import { WorkoutsStore } from './workouts.store';

const NOW = Date.parse('2026-11-19T10:00:00Z');

/** The workout the API says is open, 23 minutes in at `NOW`. */
const OPEN = {
  id: 'wl-1',
  name: 'Push day',
  startedAt: '2026-11-19T09:37:00Z',
  pausedAt: null,
  pausedSeconds: 0,
} as unknown as WorkoutLog;

const SESSION: ActiveSession = {
  id: 'wl-1',
  name: 'Push day',
  startedAt: '2026-11-19T09:37:00Z',
  pausedAt: null,
  pausedSeconds: 0,
};

/** A 90 s rest after a set of `wl-1`, 1:02 still to go at `NOW`. */
const REST: ActiveRest = {
  logId: 'wl-1',
  exerciseId: 'e-1',
  setId: 's-3',
  startedAt: NOW - 28_000,
  endsAt: NOW + 62_000,
  planned: 90,
  next: 'Set 4 · 90 kg × 5 · Squat',
};

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  TestBed.resetTestingModule();
  vi.useRealTimers();
});

/**
 * The page over stubbed stores, its template blanked, at `NOW`: the API's
 * open workout, and what the mini-bar's store holds of one.
 */
function setup(state: {
  inProgress?: WorkoutLog | null;
  session?: ActiveSession | null;
  rest?: ActiveRest | null;
  allDone?: boolean;
  progress?: SetProgress | null;
}) {
  vi.useFakeTimers({ now: NOW });
  const activeSession = {
    session: signal(state.session === undefined ? SESSION : state.session),
    rest: signal(state.rest ?? null),
    now: signal(NOW),
    allDone: signal(state.allDone ?? false),
    progress: signal(state.progress ?? null),
  };
  const finishOnOpen = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: ActiveSessionStore, useValue: activeSession },
      { provide: ActiveWorkoutService, useValue: { finishOnOpen } },
      { provide: RoutineActionsService, useValue: {} },
      { provide: WorkoutLogService, useValue: {} },
      { provide: FeedbackService, useValue: {} },
      { provide: ClockService, useValue: { now: signal(NOW), bump: vi.fn() } },
      { provide: Router, useValue: { navigate: vi.fn(() => Promise.resolve(true)) } },
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  // The page provides its own stores, so their stubs replace those.
  TestBed.overrideComponent(Workouts, {
    set: {
      template: '',
      imports: [],
      providers: [
        {
          provide: WorkoutsStore,
          useValue: {
            inProgress: signal(state.inProgress === undefined ? OPEN : state.inProgress),
            showSkeleton: signal(false),
            showError: signal(false),
            activePlans: signal([]),
            heroWorkout: signal(null),
            load: vi.fn(),
          },
        },
        { provide: HistoryStore, useValue: { refresh: vi.fn() } },
        { provide: ExercisesStore, useValue: { refresh: vi.fn() } },
      ],
    },
  });
  const fixture = TestBed.createComponent(Workouts);
  destroy = () => fixture.destroy();
  fixture.detectChanges();
  const page = fixture.componentInstance;
  return { page, fixture, activeSession, finishOnOpen };
}

describe('Workouts, the resume card', () => {
  // The mini-bar under the card showed the rest while the card still said
  // "In progress": both read the store's rest and count now.
  it('shows the rest and the set count the mini-bar shows, for the same workout', () => {
    const { page } = setup({ rest: REST, progress: { done: 7, total: 13 } });
    expect(page.openStatus().phase).toBe(HexMeterPhases.Rest);
    expect(page.openStatus().restClock).toBe('1:02');
    expect(page.openProgress()).toEqual({ done: 7, total: 13 });
  });

  it('ignores the store when it holds another workout or none', () => {
    const { page } = setup({
      session: { ...SESSION, id: 'wl-old' },
      allDone: true,
      progress: { done: 13, total: 13 },
    });
    expect(page.openProgress()).toBeNull();
    // The store's "all done" is of the other workout.
    expect(page.openStatus().phase).toBe(HexMeterPhases.Workout);
  });

  // Side by side, the card and the bar never read different seconds.
  it('counts on the mini-bar’s clock while the store holds this workout', () => {
    const { page, activeSession } = setup({});
    expect(page.elapsed()).toBe('23:00');

    activeSession.now.set(NOW + 60_000);
    expect(page.elapsed()).toBe('24:00');
  });

  it('offers Finish once every set is ticked, which the logger does', () => {
    const { page, finishOnOpen } = setup({ allDone: true });
    expect(page.openStatus().phase).toBe(HexMeterPhases.Done);

    page.finishOpen();
    expect(finishOnOpen).toHaveBeenCalledWith('wl-1');
  });

  it('finishes nothing with no workout open', () => {
    const { page, finishOnOpen } = setup({ inProgress: null });
    page.finishOpen();
    expect(finishOnOpen).not.toHaveBeenCalled();
  });
});

/** The mini-bar steps aside while the card shows (user decision, 2026-11-19). */
describe('Workouts, telling the tab shell', () => {
  it('says the card is on show on the loaded Routines tab, and not on another', () => {
    const { page, fixture } = setup({});
    const service = TestBed.inject(ResumeCardService);
    expect(service.shown()).toBe(true);

    page.setTab(WorkoutTabs.History);
    fixture.detectChanges();
    expect(service.shown()).toBe(false);
  });

  it('says no card once the page is gone', () => {
    setup({});
    const service = TestBed.inject(ResumeCardService);
    expect(service.shown()).toBe(true);

    destroy?.();
    destroy = null;
    expect(service.shown()).toBe(false);
  });
});
