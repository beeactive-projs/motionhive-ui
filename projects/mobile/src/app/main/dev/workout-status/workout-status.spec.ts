import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { translate } from 'core';

import { PreviewModes, WorkoutStatus } from './workout-status';
import { PREVIEW_NUMBER_FIELDS, PreviewScenarios } from './workout-status.config';

const NOW = Date.UTC(2026, 10, 18, 9, 0, 0);

describe('WorkoutStatus', () => {
  let page: WorkoutStatus;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string, params?: Record<string, unknown>) => translate(key, params),
          },
        },
      ],
    });
    page = TestBed.runInInjectionContext(() => new WorkoutStatus());
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  const field = (key: string) => PREVIEW_NUMBER_FIELDS.find((f) => f.key === key)!;
  const only = () => page.views()[0];

  it('opens on one resting workout', () => {
    expect(page.mode()).toBe(PreviewModes.One);
    expect(page.views()).toHaveLength(1);
    expect(only().world.rest?.endsAt).toBe(NOW + 62_000);
    expect(only().live.restEndsAt).toBe(NOW + 62_000);
  });

  it('applies a preset with its clocks from now', () => {
    vi.setSystemTime(NOW + 5_000);
    page.pick(PreviewScenarios.Paused);
    expect(page.scenario()).toBe(PreviewScenarios.Paused);
    expect(only().world.session.pausedAt).toBe(new Date(NOW + 5_000).toISOString());
    expect(only().world.rest).toBeNull();
    expect(only().android.line).toBe('Paused');
  });

  it('follows an edited field on every surface', () => {
    page.setText('name', 'Leg day');
    expect(only().world.session.name).toBe('Leg day');
    expect(only().live.title).toBe('Leg day');
    expect(only().stillTraining).toContain('Leg day');
  });

  it('takes typed numbers, and leaves the mock alone for what is not one', () => {
    page.setNumber(field('restLeft'), '-30');
    expect(page.mock().restLeft).toBe(-30);
    page.setNumber(field('restLeft'), '');
    expect(page.mock().restLeft).toBe(-30);
    page.setNumber(field('weight'), '');
    expect(page.mock().weight).toBeNull();
  });

  it('answers the rest timer buttons as the logger does', () => {
    page.nudgeRest('custom', 15);
    expect(only().world.rest?.endsAt).toBe(NOW + 77_000);
    expect(only().restBar?.endsAt).toBe(NOW + 77_000);
    page.hideRest('custom');
    expect(only().world.rest?.endsAt).toBeNull();
    expect(only().restBar).toBeNull();
    page.endRest('custom');
    expect(only().world.rest).toBeNull();
  });

  it('says the rest alert with the next set, and the old sentence without one', () => {
    expect(only().restAlert).toBe('Set 3 · 62.5 kg × 8 · Bench press');
    page.pick(PreviewScenarios.AllDone);
    expect(only().restAlert).toBe('Time for your next set.');
  });

  it('shows every preset side by side, and back to the form', () => {
    page.setMode(PreviewModes.Every);
    const keys = page.views().map((view) => view.key);
    expect(keys).toEqual(Object.values(PreviewScenarios));
    expect(page.liveJson()).toBe('');
    page.setMode('nonsense');
    expect(page.mode()).toBe(PreviewModes.Every);
    page.setMode(PreviewModes.One);
    expect(page.views()).toHaveLength(1);
    expect(page.liveJson()).toContain('"logId": "preview-log"');
  });

  it('moves the clocks on every second', () => {
    vi.advanceTimersByTime(2_000);
    expect(page.now()).toBe(NOW + 2_000);
  });
});
