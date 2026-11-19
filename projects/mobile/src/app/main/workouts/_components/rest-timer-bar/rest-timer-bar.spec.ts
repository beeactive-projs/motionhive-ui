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
      providers: [
        {
          provide: TranslateService,
          // Keys come back with their params, so a line reads `key(param|param)`.
          useValue: {
            instant: (key: string, params?: Record<string, unknown>) =>
              params ? `${key}(${Object.values(params).join('|')})` : key,
          },
        },
      ],
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

  it('drains the ring while it counts and turns it green from zero on', () => {
    const timer = bar(60);
    vi.advanceTimersByTime(30_000);
    expect(timer.meterPhase()).toBe('rest');
    expect(timer.left()).toBeCloseTo(0.5, 1);
    expect(timer.kicker()).toBe('workouts.restTimer.rest');

    vi.advanceTimersByTime(31_000);
    expect(timer.meterPhase()).toBe('over');
    expect(timer.kicker()).toBe('workouts.restTimer.restOver');
  });

  it('goes quiet again in overtime', () => {
    const timer = bar(10);
    vi.advanceTimersByTime(20_000);
    expect(timer.state()).toBe(RestStates.Over);
    expect(timer.announcement()).toBe('');
  });

  it('says the planned rest under the count, then "Get ready"', () => {
    const timer = bar(90);
    expect(timer.sub()).toBe('workouts.live.planned(1:30)');
    vi.advanceTimersByTime(85_000);
    expect(timer.sub()).toBe('workouts.restTimer.getReady');
  });

  // A label replaces what the button shows, so it carries the time too.
  it('names the clock button with how the rest stands', () => {
    const timer = bar(62);
    expect(timer.clockLabel()).toBe('workouts.restTimer.changeLeft(1:02)');
    vi.advanceTimersByTime(63_000);
    expect(timer.clockLabel()).toBe('workouts.restTimer.changeOver');
    vi.advanceTimersByTime(25_000);
    expect(timer.clockLabel()).toBe('workouts.restTimer.changeOvertime(0:26)');
  });

  /**
   * Held down to zero, the keys leave the bar and the finger's `pointerup`
   * never reaches them. The repeat went on nudging the rest back to zero
   * every 150 ms for good, and the rest never ended: no cue, no overtime.
   */
  it('stops repeating −15 s once the rest reaches zero, and then ends it', () => {
    const fixture = TestBed.createComponent(RestTimerBar);
    let end = NOW + 20_000;
    fixture.componentRef.setInput('startedAt', NOW);
    fixture.componentRef.setInput('endsAt', end);
    fixture.detectChanges();
    const timer = fixture.componentInstance;
    const nudges: number[] = [];
    let finished = 0;
    // As the logger answers a nudge: the end moves, never before now.
    timer.nudge.subscribe((seconds) => {
      nudges.push(seconds);
      end = Math.max(Date.now(), end + seconds * 1000);
      fixture.componentRef.setInput('endsAt', end);
      fixture.detectChanges();
    });
    timer.finished.subscribe(() => finished++);

    timer.holdStart(-1, { preventDefault: () => undefined } as PointerEvent);
    // Held well past zero, and never let go (the key is gone).
    vi.advanceTimersByTime(3_000);
    fixture.detectChanges();

    expect(nudges).toEqual([-15, -15]);
    expect(finished).toBe(1);
    expect(timer.state()).toBe(RestStates.Go);
  });
});
