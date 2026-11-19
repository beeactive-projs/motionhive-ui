import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { AppModeStore, AuthStore } from 'core';

import { MoreBadgesService } from '../../_shared/services/more-badges.service';
import { More } from './more';

describe('More', () => {
  it('opens the workout status preview from its developer row', () => {
    const navigateByUrl = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: AuthStore,
          useValue: { user: signal(null), userName: signal(''), isInstructor: signal(false) },
        },
        { provide: AppModeStore, useValue: { mode: signal(null) } },
        {
          provide: MoreBadgesService,
          useValue: {
            hasBillDue: signal(false),
            hasOverdueInvoices: signal(false),
            hasCoachInvites: signal(false),
            refresh: vi.fn(),
          },
        },
      ],
    });
    const menu = TestBed.runInInjectionContext(() => new More());

    menu.openWorkoutStatus();

    expect(navigateByUrl).toHaveBeenCalledWith('/tabs/more/dev/workout-status');
  });
});
