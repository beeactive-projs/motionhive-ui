import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { IonRouterOutlet, NavController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  ClientCopyService,
  CopyDayLock,
  CopyOverview,
  ProgramAssignmentStatus,
} from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ClientCopy, QUIET_DONE_DELAY_MS } from './client-copy';

function overview(status: ProgramAssignmentStatus = ProgramAssignmentStatus.Active): CopyOverview {
  const day = (id: string, weekIndex: number, date: string, lock: CopyDayLock | null) => ({
    id,
    name: id,
    notes: null,
    weekIndex,
    dayIndex: 0,
    scheduledDate: date,
    status: null,
    lock,
    editable: lock === null,
    changed: false,
    exerciseCount: 3,
  });
  return {
    today: '2026-11-20',
    assignment: {
      id: 'a-1',
      status,
      programNameSnapshot: 'Strength Base',
      masterProgramId: 'p-1',
      startDate: '2026-11-02',
      endDate: '2026-12-25',
      completionPercent: 25,
      clientId: 'client-1',
      client: { id: 'client-1', firstName: 'Anna', lastName: 'Popescu', avatarUrl: null, handle: null },
    },
    days: [
      day('w1', 0, '2026-11-02', CopyDayLock.Done),
      day('w2', 1, '2026-11-09', CopyDayLock.Done),
      day('past', 2, '2026-11-16', CopyDayLock.Past),
      day('next', 2, '2026-11-23', null),
    ],
  };
}

function setup(status?: ProgramAssignmentStatus) {
  const done = vi.fn(() => of({ notified: true, days: 1 }));
  const copyService = { overview: vi.fn(() => of(overview(status))), done };
  const navigate = vi.fn();
  const pop = vi.fn(() => Promise.resolve(true));
  const success = vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    providers: [
      { provide: ClientCopyService, useValue: copyService },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ assignmentId: 'a-1' }) } },
      },
      { provide: Router, useValue: { url: '/tabs/clients/copy/a-1', navigate } },
      { provide: NavController, useValue: { setDirection: vi.fn(), navigateBack: vi.fn() } },
      { provide: IonRouterOutlet, useValue: { canGoBack: () => true, pop } },
      { provide: FeedbackService, useValue: { success, error: vi.fn(() => Promise.resolve()) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const page = TestBed.runInInjectionContext(() => new ClientCopy());
  page.ionViewWillEnter();
  return { page, copyService, done, navigate, pop, success };
}

describe("ClientCopy, a client's copy of a plan", () => {
  it('folds the done weeks and draws the weeks still to come', () => {
    const { page } = setup();
    expect(page.doneLine()).toBe("Weeks 1 and 2 are done. You see them in Training, but can't change them.");
    expect(page.openWeeks().map((week) => week.rows.map((row) => [row.id, row.editable]))).toEqual([
      [
        ['past', false],
        ['next', true],
      ],
    ]);
  });

  it('opens a day still to come in this stack, and never a locked one', () => {
    const { page, navigate } = setup();
    const [past, next] = page.openWeeks()[0].rows;
    page.openDay(past);
    expect(navigate).not.toHaveBeenCalled();
    page.openDay(next);
    expect(navigate).toHaveBeenCalledWith(['/tabs/clients', 'copy', 'a-1', 'day', 'next']);
  });

  it('shows no days to edit once the plan stopped running', () => {
    const { page } = setup(ProgramAssignmentStatus.Cancelled);
    expect(page.closed()).toBe(true);
    expect(page.openWeeks()).toEqual([]);
  });

  it('Done tells the client once, says so, and goes back', async () => {
    const { page, done, pop, success } = setup();
    await page.done();
    expect(done).toHaveBeenCalledWith('a-1');
    expect(success).toHaveBeenCalledWith('programs.clientCopy.toast.notified');
    expect(pop).toHaveBeenCalled();
    // Leaving after Done sends nothing more.
    TestBed.resetTestingModule();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('leaving without Done still tells the client, quietly, once the last save has landed', () => {
    vi.useFakeTimers();
    const { done } = setup();
    TestBed.resetTestingModule();
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(QUIET_DONE_DELAY_MS);
    expect(done).toHaveBeenCalledWith('a-1', { silent: true });
    vi.useRealTimers();
  });
});
