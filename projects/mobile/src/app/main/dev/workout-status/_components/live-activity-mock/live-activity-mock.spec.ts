import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { translate } from 'core';

import { liveState } from '../../../../workouts/_services/lock-screen.config';
import {
  LiveLayouts,
  LivePhases,
  PreviewScenarios,
  previewMock,
  previewWorld,
} from '../../workout-status.config';
import { LiveActivityMock } from './live-activity-mock';

const NOW = Date.UTC(2026, 10, 18, 9, 0, 0);

describe('LiveActivityMock', () => {
  it('draws the lock screen by default, from the state at the moment given', () => {
    TestBed.overrideComponent(LiveActivityMock, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(LiveActivityMock);
    const mock = previewMock(PreviewScenarios.Resting, translate);
    const { session, rest, next, steps } = previewWorld(mock, NOW, translate);
    fixture.componentRef.setInput('state', liveState(session, rest, next, translate, NOW, steps));
    fixture.componentRef.setInput('now', NOW);
    fixture.detectChanges();
    const mockup = fixture.componentInstance;

    expect(mockup.layout()).toBe(LiveLayouts.Lock);
    expect(mockup.face().phase).toBe(LivePhases.Rest);

    // The phone turns the rest to Done on its own when its end passes.
    fixture.componentRef.setInput('now', NOW + (mock.restLeft + 1) * 1000);
    expect(mockup.face().phase).toBe(LivePhases.Go);
  });
});
