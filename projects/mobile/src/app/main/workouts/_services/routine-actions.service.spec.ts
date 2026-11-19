import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { RoutineService } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { RoutineActionsService } from './routine-actions.service';

describe('RoutineActionsService.remove', () => {
  it("cancels the routine's days still ahead on a schedule with it", () => {
    const remove = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [
        { provide: RoutineService, useValue: { remove } },
        { provide: FeedbackService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });

    TestBed.inject(RoutineActionsService).remove('r-1').subscribe();

    expect(remove).toHaveBeenCalledWith('r-1', true);
  });
});
