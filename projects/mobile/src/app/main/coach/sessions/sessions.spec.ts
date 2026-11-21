import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { SessionInstance, SessionService, SessionTemplate, SessionsInstructorStore } from 'core';

import { ClockService } from '../../../_shared/services/clock.service';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { Sessions } from './sessions';

interface SetupOptions {
  stale?: boolean;
  hasAny?: boolean | null;
  rows?: SessionInstance[];
  getTemplate?: (id: string) => Observable<SessionTemplate>;
}

function setup(options: SetupOptions = {}) {
  const rangeInstances = signal<SessionInstance[]>(options.rows ?? []);
  const hasAnySessions = signal<boolean | null>(options.hasAny ?? null);
  const loadRange = vi.fn((_range: unknown, opts: { force?: boolean; done?: () => void }) => opts.done?.());
  const store = {
    rangeInstances,
    rangeLoading: signal(false),
    rangeError: signal<string | null>(null),
    rangeTruncated: signal(false),
    hasAnySessions,
    loadRange,
    takeRangeStale: vi.fn(() => options.stale ?? false),
    checkHasAnySessions: vi.fn(),
  };
  const feedback = { success: vi.fn(), error: vi.fn() };
  const getTemplate = vi.fn(options.getTemplate ?? (() => of(SERIES)));
  TestBed.configureTestingModule({
    providers: [
      { provide: SessionsInstructorStore, useValue: store },
      { provide: Router, useValue: { url: '/tabs/more/sessions', navigate: vi.fn() } },
      { provide: ClockService, useValue: { now: signal(Date.now()), bump: vi.fn() } },
      { provide: FeedbackService, useValue: feedback },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: SessionService, useValue: { getTemplate } },
    ],
  });
  TestBed.overrideComponent(Sessions, { set: { template: '', imports: [] } });
  const page = TestBed.createComponent(Sessions).componentInstance;
  return { page, store, hasAnySessions, loadRange, getTemplate, feedback };
}

/** A row as the agenda holds it: the short template, with no repeat rule. */
const ROW = {
  id: 'i-1',
  templateId: 't-1',
  status: 'SCHEDULED',
  startAt: '2030-11-25T17:00:00.000Z',
  endAt: '2030-11-25T18:00:00.000Z',
  titleOverride: null,
  capacityOverride: null,
  meetingUrlOverride: null,
  venueIdOverride: null,
  confirmedCount: 0,
  pendingApprovalCount: 0,
  template: { title: 'Strength club', type: 'GROUP', timezone: 'Europe/Bucharest' },
} as unknown as SessionInstance;

/** The same series read on its own, with its rule. */
const SERIES = {
  id: 't-1',
  title: 'Strength club',
  type: 'GROUP',
  access: 'OPEN',
  timezone: 'Europe/Bucharest',
  durationMinutes: 60,
  priceAmountCents: 4950,
  priceCurrency: 'RON',
  isRecurring: true,
  recurrenceRule: { frequency: 'WEEKLY', interval: 1, daysOfWeek: [2] },
} as unknown as SessionTemplate;

describe('Sessions, the coach agenda', () => {
  // The window did not change, so a cancel or an edit made on the detail
  // page never reached the list.
  it('reloads an unchanged window when a detail page marked it stale', () => {
    const { page, loadRange } = setup({ stale: true });
    page.ionViewWillEnter();
    expect(loadRange.mock.calls[0][1].force).toBe(true);
  });

  it('keeps the cached window when nothing changed', () => {
    const { page, loadRange } = setup({ rows: [{ id: 'i-1' } as SessionInstance] });
    page.ionViewWillEnter();
    page.ionViewWillEnter();
    expect(loadRange).toHaveBeenCalledTimes(1);
    expect(loadRange.mock.calls[0][1].force).toBeFalsy();
  });

  // A month far ahead with nothing in it took the whole screen and hid the
  // calendar the coach would page back with.
  it('shows the first-run screen only for a coach with no session at all', () => {
    const { page, store, hasAnySessions } = setup();
    page.ionViewWillEnter();
    expect(store.checkHasAnySessions).toHaveBeenCalled();

    // Still asking: a placeholder, not the first-run screen.
    expect(page.isEmpty()).toBe(false);
    expect(page.showSkeleton()).toBe(true);

    hasAnySessions.set(true);
    expect(page.isEmpty()).toBe(false);
    expect(page.showSkeleton()).toBe(false);
    expect(page.showChrome()).toBe(true);

    hasAnySessions.set(false);
    expect(page.isEmpty()).toBe(true);
  });

  it('offers no new session on an hour already begun', () => {
    const { page } = setup({ hasAny: true });
    page.pickDay(new Date(2020, 0, 1));
    page.createAt(10);
    expect(page.createOpen()).toBe(false);

    page.pickDay(new Date(2100, 0, 1));
    page.createAt(10);
    expect(page.createOpen()).toBe(true);
  });

  // The row's short template has no rule, so a series was copied as a one-off.
  describe('duplicating a row', () => {
    it('reads the full template first, then opens the copy as a series', () => {
      const reply = new Subject<SessionTemplate>();
      const { page, getTemplate } = setup({ getTemplate: () => reply });
      page.duplicate(ROW);
      expect(getTemplate).toHaveBeenCalledWith('t-1');
      expect(page.createOpen()).toBe(false);

      // A second tap while the first is on its way asks nothing more.
      page.duplicate(ROW);
      expect(getTemplate).toHaveBeenCalledTimes(1);

      reply.next(SERIES);
      expect(page.createOpen()).toBe(true);
      expect(page.createPrefill()?.isRecurring).toBe(true);
      expect(page.createPrefill()?.daysOfWeek).toEqual([2]);
    });

    it('says so and opens nothing when the template cannot be read', () => {
      const reply = new Subject<SessionTemplate>();
      const { page, feedback } = setup({ getTemplate: () => reply });
      page.duplicate(ROW);
      const failure = new Error('offline');
      reply.error(failure);
      expect(feedback.error).toHaveBeenCalledWith(failure, 'sessions.toast.duplicateFailed');
      expect(page.createOpen()).toBe(false);
      expect(page.duplicating()).toBe(false);
    });
  });

  it('reschedules a row in place, and reloads the window once it moved', async () => {
    const { page, loadRange } = setup({ hasAny: true });
    page.openQuickActions(ROW);
    await page.onAction('reschedule');
    expect(page.rescheduleOpen()).toBe(true);
    expect(page.rescheduleInstance()).toBe(ROW);

    page.onRescheduled();
    const calls = loadRange.mock.calls;
    expect(calls[calls.length - 1][1].force).toBe(true);
  });
});
