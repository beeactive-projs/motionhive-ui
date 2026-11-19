import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { APP_HOME_URL } from 'core';

import { ActiveWorkoutService } from '../../main/workouts/_services/active-workout.service';
import { AppLinkService } from './app-link.service';

/** The service over a stubbed router and workouts service; links go in through `open`. */
function setup() {
  const navigate = vi.fn(() => Promise.resolve(true));
  const finishOnOpen = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: Router, useValue: { navigate, navigateByUrl: vi.fn() } },
      { provide: APP_HOME_URL, useValue: '/tabs/home' },
      { provide: ActiveWorkoutService, useValue: { finishOnOpen } },
    ],
  });
  const service = TestBed.inject(AppLinkService);
  const open = (url: string) => service['open'](url);
  return { open, navigate, finishOnOpen };
}

describe('AppLinkService, links from the lock screen', () => {
  // Finish workout: the logger opens and finishes it, as the resume card's Finish does.
  it('hands Finish workout to the workouts service, which opens the logger to finish', () => {
    const { open, navigate, finishOnOpen } = setup();

    open('motionhive://log/wl-1?finish=1');

    expect(finishOnOpen).toHaveBeenCalledWith('wl-1');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the logger on the set for Edit set, and finishes nothing', () => {
    const { open, navigate, finishOnOpen } = setup();

    open('motionhive://log/wl-1?set=s-2');

    expect(navigate).toHaveBeenCalledWith(['/tabs/workouts/log', 'wl-1'], {
      queryParams: { set: 's-2' },
    });
    expect(finishOnOpen).not.toHaveBeenCalled();
  });
});
