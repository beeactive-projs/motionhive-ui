import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { translate } from 'core';

import { allSetsDone } from '../../../../workouts/_services/active-session.store';
import { liveState } from '../../../../workouts/_services/lock-screen.config';
import {
  LiveLayout,
  LiveLayouts,
  LivePhases,
  PreviewScenario,
  PreviewScenarios,
  previewMock,
  previewWorld,
} from '../../workout-status.config';
import { LiveActivityMock } from './live-activity-mock';

const NOW = Date.UTC(2026, 10, 18, 9, 0, 0);

/** The mock-up of a preset, as the app would send it at `NOW`. */
function mount(scenario: PreviewScenario, layout: LiveLayout): LiveActivityMock {
  const fixture = TestBed.createComponent(LiveActivityMock);
  const world = previewWorld(previewMock(scenario, translate), NOW, translate);
  const { session, rest, next, steps, progress } = world;
  const state = liveState(session, rest, next, translate, NOW, steps, allSetsDone(progress));
  fixture.componentRef.setInput('state', state);
  fixture.componentRef.setInput('now', NOW);
  fixture.componentRef.setInput('layout', layout);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('LiveActivityMock', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TranslateService,
          useValue: { instant: (key: string, params?: Record<string, unknown>) => translate(key, params) },
        },
      ],
    });
    TestBed.overrideComponent(LiveActivityMock, { set: { template: '', imports: [] } });
  });

  it('draws the lock screen by default, from the state at the moment given', () => {
    const fixture = TestBed.createComponent(LiveActivityMock);
    const mock = previewMock(PreviewScenarios.Resting, translate);
    const { session, rest, next, steps } = previewWorld(mock, NOW, translate);
    fixture.componentRef.setInput('state', liveState(session, rest, next, translate, NOW, steps));
    fixture.componentRef.setInput('now', NOW);
    fixture.detectChanges();
    const mockup = fixture.componentInstance;

    expect(mockup.layout()).toBe(LiveLayouts.Lock);
    expect(mockup.face().phase).toBe(LivePhases.Rest);
    // The large ring drains in honey with the time inside it.
    expect(mockup.meterPhase()).toBe('rest');
    expect(mockup.timeInRing()).toBe(true);

    // The phone turns the rest to Done on its own when its end passes.
    fixture.componentRef.setInput('now', NOW + (mock.restLeft + 1) * 1000);
    expect(mockup.face().phase).toBe(LivePhases.Go);
    // Rest over: the filled green hexagon with its tick, no time in it.
    expect(mockup.meterPhase()).toBe('over');
    expect(mockup.timeInRing()).toBe(false);
  });

  it('says the kicker as RichView does, the workout name first', () => {
    expect(mount(PreviewScenarios.BetweenSets, LiveLayouts.Lock).kicker()).toBe(
      'Push day · Workout',
    );
    expect(mount(PreviewScenarios.Paused, LiveLayouts.Lock).kicker()).toBe('Push day · Paused');
  });

  // RestLive.java: the sub text says Workout while paused, and the button is Open, not Continue.
  it('draws the Android card from RestLive.java while paused', () => {
    const mockup = mount(PreviewScenarios.Paused, LiveLayouts.Android);
    expect(mockup.android().sub).toBe('Workout');
    expect(mockup.android().actions).toEqual(['Open']);
    expect(mockup.card().kicker).toBe('Paused · Push day');
    expect(mockup.cardMeterPhase()).toBe('paused');
  });

  it('keeps the clock in the Android ring once all is done, where iOS shows its trophy', () => {
    const mockup = mount(PreviewScenarios.AllDone, LiveLayouts.Android);
    expect(mockup.cardMeterPhase()).toBe('done');
    expect(mockup.card().clock).toBe('52:00');
    expect(mockup.meterPhase()).toBe('done');
    expect(mockup.timeInRing()).toBe(false);
  });
});
