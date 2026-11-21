import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RescheduleInstanceResponse, SessionInstance, SessionService } from 'core';

import { FeedbackService } from '../../../../../_shared/services/feedback.service';
import { RescheduleSheet } from './reschedule-sheet';

/** A date well ahead, at 16:00 UTC: 16:00 in London, 18:00 in Bucharest. */
const INSTANCE = {
  id: 'i-1',
  status: 'SCHEDULED',
  startAt: '2030-11-21T16:00:00.000Z',
  endAt: '2030-11-21T17:00:00.000Z',
  titleOverride: null,
  template: { title: 'Strength club', timezone: 'Europe/London' },
} as unknown as SessionInstance;

function answer(overrides: Partial<RescheduleInstanceResponse> = {}): RescheduleInstanceResponse {
  return {
    instanceId: 'i-1',
    oldStartAt: INSTANCE.startAt,
    newStartAt: '2030-11-22T16:00:00.000Z',
    notifiedUserIds: ['u-1', 'u-2'],
    warnings: [],
    ...overrides,
  };
}

describe('RescheduleSheet', () => {
  let rescheduleInstance: ReturnType<typeof vi.fn>;
  let success: ReturnType<typeof vi.fn>;
  let error: ReturnType<typeof vi.fn>;
  const instant = vi.fn((key: string) => key);

  beforeEach(() => {
    rescheduleInstance = vi.fn(() => of(answer()));
    success = vi.fn();
    error = vi.fn();
    instant.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: { rescheduleInstance } },
        { provide: FeedbackService, useValue: { success, error } },
        { provide: TranslateService, useValue: { instant } },
      ],
    });
    TestBed.overrideComponent(RescheduleSheet, { set: { template: '', imports: [] } });
  });

  function open(timezone: string | null = null) {
    const fixture = TestBed.createComponent(RescheduleSheet);
    fixture.componentRef.setInput('instance', INSTANCE);
    fixture.componentRef.setInput('timezone', timezone);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it("opens on the date as it is, on the session's own clock", () => {
    const sheet = open();
    expect(sheet.zone()).toBe('Europe/London');
    expect(sheet.startAt()).toBe('2030-11-21T16:00');
    expect(sheet.startIso()).toBe(INSTANCE.startAt);
  });

  it("prefers the series' zone when the page has the full template", () => {
    const sheet = open('Europe/Bucharest');
    expect(sheet.startAt()).toBe('2030-11-21T18:00');
  });

  it('moves nothing until another time is picked', () => {
    const sheet = open();
    expect(sheet.canSave()).toBe(false);
    sheet.onStartChange('2030-11-22T16:00');
    expect(sheet.canSave()).toBe(true);
  });

  it('refuses a time that has passed', () => {
    const sheet = open();
    sheet.onStartChange('2020-01-01T09:00');
    expect(sheet.startError()).toBe('sessions.form.errors.startPast');
    expect(sheet.canSave()).toBe(false);
    sheet.save();
    expect(rescheduleInstance).not.toHaveBeenCalled();
  });

  it('sends the picked wall clock read in the zone, then says who was told', () => {
    const sheet = open();
    const moved = vi.fn();
    sheet.rescheduled.subscribe(moved);
    sheet.onStartChange('2030-11-22T18:30');
    sheet.save();

    expect(rescheduleInstance).toHaveBeenCalledWith('i-1', {
      newStartAt: '2030-11-22T18:30:00.000Z',
    });
    expect(instant).toHaveBeenCalledWith('sessions.toast.rescheduled', { count: 2 });
    expect(success).toHaveBeenCalledWith('sessions.toast.rescheduled');
    expect(moved).toHaveBeenCalled();
    expect(sheet.open()).toBe(false);
  });

  it('sends the note with the new time when there is one, trimmed', () => {
    const sheet = open();
    sheet.onStartChange('2030-11-22T18:30');
    sheet.note.set('  Park is booked, see you at 10.  ');
    sheet.save();

    expect(rescheduleInstance).toHaveBeenCalledWith('i-1', {
      newStartAt: '2030-11-22T18:30:00.000Z',
      message: 'Park is booked, see you at 10.',
    });
  });

  it('starts each opening without the last note', () => {
    const sheet = open();
    sheet.note.set('old');
    sheet.open.set(false);
    TestBed.tick();
    sheet.open.set(true);
    TestBed.tick();
    expect(sheet.note()).toBe('');
  });

  // The API warns about an overlap rather than refusing the move.
  it('says when the new time overlaps another session', () => {
    rescheduleInstance.mockReturnValue(
      of(answer({ warnings: [{ code: 'CONFLICT', instanceIds: ['i-2'] }] })),
    );
    const sheet = open();
    sheet.onStartChange('2030-11-22T16:00');
    sheet.save();
    expect(success).toHaveBeenCalledWith('sessions.toast.rescheduledWithOverlap');
  });

  it('stays open with the reason when the API refuses', () => {
    const failure = new Error('nope');
    rescheduleInstance.mockReturnValue(throwError(() => failure));
    const sheet = open();
    sheet.onStartChange('2030-11-22T16:00');
    sheet.save();
    expect(error).toHaveBeenCalledWith(failure, 'sessions.toast.rescheduleFailed');
    expect(sheet.open()).toBe(true);
    expect(sheet.saving()).toBe(false);
  });
});
