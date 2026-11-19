import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { SetProgress } from '../../_services/active-session.store';
import { ActiveStatus } from '../../_services/active-status.config';
import { HexMeterPhases } from '../hex-meter/hex-meter';
import { ResumeCard } from './resume-card';

const NEXT = 'Set 4 · 90 kg × 5 · Squat';

const PAUSED: ActiveStatus = {
  phase: HexMeterPhases.Paused,
  icon: 'pause-outline',
  rest: null,
  share: 0,
  restClock: '',
};

const RESTING: ActiveStatus = {
  phase: HexMeterPhases.Rest,
  icon: 'timer-outline',
  rest: { left: 62, planned: 90, next: NEXT },
  share: 62 / 90,
  restClock: '1:02',
};

/** The rest's very end: nothing over yet. */
const REST_OVER: ActiveStatus = {
  phase: HexMeterPhases.Over,
  icon: 'timer-outline',
  rest: { left: -0.4, planned: 90, next: NEXT },
  share: 0,
  restClock: '+0:00',
};

const OVERTIME: ActiveStatus = {
  ...REST_OVER,
  rest: { left: -25, planned: 90, next: NEXT },
  restClock: '+0:25',
};

const ALL_DONE: ActiveStatus = {
  phase: HexMeterPhases.Done,
  icon: 'trophy-outline',
  rest: null,
  share: 0,
  restClock: '',
};

describe('ResumeCard', () => {
  function build(status?: ActiveStatus, progress?: SetProgress) {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
    });
    TestBed.overrideComponent(ResumeCard, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(ResumeCard);
    fixture.componentRef.setInput('name', 'Push day');
    fixture.componentRef.setInput('elapsed', '23:00');
    if (status !== undefined) fixture.componentRef.setInput('status', status);
    if (progress !== undefined) fixture.componentRef.setInput('progress', progress);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('holds the name and the clock it is given', () => {
    const card = build();
    expect(card.name()).toBe('Push day');
    expect(card.elapsed()).toBe('23:00');
  });

  it('is a workout between sets unless told otherwise, with Resume', () => {
    const card = build();
    expect(card.meterPhase()).toBe(HexMeterPhases.Workout);
    expect(card.icon()).toBe('barbell-outline');
    expect(card.meta()).toEqual({ key: 'workouts.home.workout', params: { elapsed: '23:00' } });
    expect(card.buttonKey()).toBe('button.resume');
    expect(card.ok()).toBe(false);
  });

  it('says how many sets are done, once the logger has counted them', () => {
    const card = build(undefined, { done: 7, total: 13 });
    expect(card.meta()).toEqual({
      key: 'workouts.home.workoutSets',
      params: { elapsed: '23:00', done: 7, total: 13 },
    });
  });

  // The mini-bar under it showed the rest while the card still said "In progress".
  it('drains with the rest and says what is left of it', () => {
    const card = build(RESTING, { done: 7, total: 13 });
    expect(card.meterPhase()).toBe(HexMeterPhases.Rest);
    expect(card.left()).toBe(62 / 90);
    expect(card.meta()).toEqual({
      key: 'workouts.home.resting',
      params: { left: '1:02', planned: '1:30' },
    });
    expect(card.buttonKey()).toBe('button.resume');
  });

  it('says the rest is over in green, then by how much', () => {
    const over = build(REST_OVER);
    expect(over.meterPhase()).toBe(HexMeterPhases.Over);
    expect(over.meta()).toEqual({ key: 'workouts.home.restOver', params: {} });
    expect(over.ok()).toBe(true);
    TestBed.resetTestingModule();

    expect(build(OVERTIME).meta()).toEqual({
      key: 'workouts.home.restOvertime',
      params: { over: '+0:25' },
    });
  });

  it('draws a dashed ring and a pause sign while paused, with Continue', () => {
    const card = build(PAUSED);
    expect(card.paused()).toBe(true);
    expect(card.meterPhase()).toBe(HexMeterPhases.Paused);
    expect(card.icon()).toBe('pause-outline');
    expect(card.meta()).toEqual({ key: 'workouts.home.paused', params: { elapsed: '23:00' } });
    expect(card.buttonKey()).toBe('button.continue');
  });

  it('offers Finish workout once every set is done, in green', () => {
    const card = build(ALL_DONE, { done: 13, total: 13 });
    expect(card.meterPhase()).toBe(HexMeterPhases.Done);
    expect(card.meta()).toEqual({ key: 'workouts.home.allDone', params: { elapsed: '23:00' } });
    expect(card.ok()).toBe(true);
    expect(card.buttonKey()).toBe('workouts.home.finish');
  });

  it('finishes from its button once all done, and resumes otherwise', () => {
    const done = build(ALL_DONE);
    const finish = vi.fn();
    const resume = vi.fn();
    done.finish.subscribe(finish);
    done.resume.subscribe(resume);
    done.act();
    expect(finish).toHaveBeenCalledOnce();
    expect(resume).not.toHaveBeenCalled();
    TestBed.resetTestingModule();

    const resting = build(RESTING);
    const back = vi.fn();
    resting.resume.subscribe(back);
    resting.act();
    expect(back).toHaveBeenCalledOnce();
  });
});
