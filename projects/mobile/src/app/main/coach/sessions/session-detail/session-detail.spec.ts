import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { NavController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  SessionInstance,
  SessionTemplate,
  SessionsDetailStore,
  SessionsInstructorStore,
} from 'core';

import { ClockService } from '../../../../_shared/services/clock.service';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { SessionDetail } from './session-detail';

const NOW = new Date('2026-11-21T09:00:00Z').getTime();

const INSTANCE = {
  id: 'i-1',
  templateId: 't-1',
  status: 'SCHEDULED',
  startAt: '2026-11-25T17:00:00.000Z',
  endAt: '2026-11-25T18:00:00.000Z',
  occurrenceIndex: 0,
  titleOverride: null,
  capacityOverride: null,
  meetingUrlOverride: null,
  venueIdOverride: null,
  confirmedCount: 0,
  pendingApprovalCount: 0,
  // The instance's own template: the API's short list, with no rule.
  template: { title: 'Strength club', type: 'GROUP', recurrenceRule: undefined },
} as unknown as SessionInstance;

/** The full template the detail store reads on its own. */
const FULL = {
  id: 't-1',
  title: 'Strength club',
  type: 'GROUP',
  access: 'OPEN',
  locationKind: 'IN_PERSON',
  durationMinutes: 60,
  timezone: 'Europe/Bucharest',
  capacity: 12,
  priceAmountCents: 4950,
  priceCurrency: 'RON',
  isRecurring: true,
  recurrenceRule: { frequency: 'WEEKLY', interval: 1, daysOfWeek: [3] },
} as unknown as SessionTemplate;

function setup(url = '/tabs/more/sessions/i-1', template: SessionTemplate = FULL) {
  const navigate = vi.fn();
  const back = vi.fn();
  const markRangeStale = vi.fn();
  const detail = {
    load: vi.fn(),
    reload: vi.fn(),
    instance: signal(INSTANCE),
    template: signal(template),
    participants: signal([]),
    counts: signal({ confirmed: 0, pending: 0, waitlisted: 0, attended: 0, noShow: 0 }),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'i-1' })) } },
      { provide: Router, useValue: { url, navigate } },
      { provide: NavController, useValue: { back } },
      { provide: ClockService, useValue: { now: signal(NOW), bump: vi.fn() } },
      { provide: FeedbackService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: SessionsInstructorStore, useValue: { markRangeStale } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  TestBed.overrideComponent(SessionDetail, {
    set: {
      template: '',
      imports: [],
      providers: [{ provide: SessionsDetailStore, useValue: detail }],
    },
  });
  const page = TestBed.createComponent(SessionDetail).componentInstance;
  return { page, navigate, back, markRangeStale, detail };
}

describe('SessionDetail', () => {
  // The agenda trusted its cached window, so a cancelled session stayed on it.
  it('tells the agenda to reload after a cancel, an edit, a copy or a capacity change', () => {
    const { page, markRangeStale, detail } = setup();
    page.onCancelled();
    page.onEdited();
    page.onDuplicated();
    page.onCapacityChanged();
    expect(markRangeStale).toHaveBeenCalledTimes(4);
    expect(detail.reload).toHaveBeenCalledTimes(2);
  });

  it('goes back to the agenda after a cancel in its own stack', () => {
    const { page, navigate } = setup();
    page.onCancelled();
    expect(navigate).toHaveBeenCalled();
  });

  // The instance's nested template has no rule, so a weekly series was
  // copied as a one-off.
  it('duplicates a series as a series, from the full template', () => {
    const { page } = setup();
    page.duplicateThis();
    const prefill = page.duplicatePrefill();
    expect(prefill?.isRecurring).toBe(true);
    expect(prefill?.daysOfWeek).toEqual([3]);
    expect(prefill?.timezone).toBe('Europe/Bucharest');
    expect(page.duplicateOpen()).toBe(true);
  });

  // Cancel and recreate lost every booking.
  it('reschedules in place, then shows the new time and tells the agenda', () => {
    const { page, markRangeStale, detail } = setup();
    void page.onAction('reschedule');
    expect(page.rescheduleOpen()).toBe(true);

    page.onRescheduled();
    expect(detail.reload).toHaveBeenCalledTimes(1);
    expect(markRangeStale).toHaveBeenCalledTimes(1);
  });

  // "Paid" stood beside a free price on sessions saved before a price was asked for.
  it('names a paid session without a price Free, and a priced one Paid', () => {
    expect(setup().page.accessLabel()).toBe('Paid');
    TestBed.resetTestingModule();
    const { page } = setup(undefined, { ...FULL, priceAmountCents: 0 } as SessionTemplate);
    expect(page.accessLabel()).toBe('Free');
    expect(page.accessTone()).toBe('success');
    expect(page.detailRows().map((row) => row.title)).toContain('Free');
  });

  // `toFixed(0)` showed 49.50 as 50.
  it('shows the price with its cents', () => {
    const { page } = setup();
    expect(page.price()).toBe('49.50 RON');
  });
});
