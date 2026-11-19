import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RestStates, RestTimerBar } from './rest-timer-bar';

const NOW = Date.UTC(2026, 10, 18, 9, 0, 0);

describe('RestTimerBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
    });
    TestBed.overrideComponent(RestTimerBar, { set: { template: '', imports: [] } });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  /** A rest of `planned` seconds, begun now. */
  function bar(planned: number) {
    const fixture = TestBed.createComponent(RestTimerBar);
    fixture.componentRef.setInput('startedAt', NOW);
    fixture.componentRef.setInput('endsAt', NOW + planned * 1000);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('says nothing while the rest counts', () => {
    const timer = bar(60);
    vi.advanceTimersByTime(30_000);
    expect(timer.state()).toBe(RestStates.Counting);
    expect(timer.announcement()).toBe('');
  });

  it('says so once, at the last ten seconds and at the end, never the count', () => {
    const timer = bar(60);
    vi.advanceTimersByTime(52_000);
    expect(timer.state()).toBe(RestStates.Soon);
    expect(timer.announcement()).toBe('workouts.restTimer.getReady');

    vi.advanceTimersByTime(3_000);
    // Each second of the last ten reads the same: a live region repeats nothing.
    expect(timer.announcement()).toBe('workouts.restTimer.getReady');

    vi.advanceTimersByTime(5_250);
    expect(timer.state()).toBe(RestStates.Go);
    expect(timer.announcement()).toBe('workouts.restTimer.restOver');
  });

  it('goes quiet again in overtime', () => {
    const timer = bar(10);
    vi.advanceTimersByTime(20_000);
    expect(timer.state()).toBe(RestStates.Over);
    expect(timer.announcement()).toBe('');
  });
});
