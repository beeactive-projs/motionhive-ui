import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { PublicSessionInstance, SessionService, WEB_APP_URL } from 'core';

import { sessionCalendarEvent } from '../config/session-calendar.config';
import { FeedbackService } from './feedback.service';
import { SessionCalendarService } from './session-calendar.service';

function session(patch: Record<string, unknown> = {}): PublicSessionInstance {
  return {
    id: 'inst-1',
    startAt: '2026-11-28T07:00:00Z',
    endAt: '2026-11-28T08:00:00Z',
    titleOverride: null,
    venueOverride: null,
    template: {
      title: 'Morning run',
      locationKind: 'IN_PERSON',
      venue: { id: 'v-1', name: 'Parcul Central', city: 'Cluj-Napoca', kind: 'PARK' },
    },
    ...patch,
  } as unknown as PublicSessionInstance;
}

describe('sessionCalendarEvent', () => {
  it("fills in the title, times, the series' place and the session's link", () => {
    expect(sessionCalendarEvent(session(), 'Session')).toEqual({
      title: 'Morning run',
      startDate: Date.parse('2026-11-28T07:00:00Z'),
      endDate: Date.parse('2026-11-28T08:00:00Z'),
      location: 'Parcul Central, Cluj-Napoca',
      url: `${WEB_APP_URL}/sessions/inst-1`,
    });
  });

  it("prefers the date's own title and place", () => {
    const event = sessionCalendarEvent(
      session({ titleOverride: 'Run, rain plan', venueOverride: { name: 'Sala Mare', city: null } }),
      'Session',
    );
    expect(event.title).toBe('Run, rain plan');
    expect(event.location).toBe('Sala Mare');
  });

  it('says Online for an online session, never a meeting link', () => {
    const online = session({ template: { title: 'Mobility', locationKind: 'ONLINE', meetingUrl: 'https://x' } });
    const event = sessionCalendarEvent(online, 'Session');
    expect(event.location).not.toContain('https://');
    expect(event.location).toBeTruthy();
  });
});

describe('SessionCalendarService', () => {
  function setup() {
    const feedback = { success: vi.fn(() => Promise.resolve()), error: vi.fn(() => Promise.resolve()) };
    const sessions = { downloadIcs: vi.fn(() => of(undefined)) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: sessions },
        { provide: FeedbackService, useValue: feedback },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const service = TestBed.inject(SessionCalendarService);
    return { service, feedback, sessions };
  }

  it("opens the phone's new-event screen, filled in, and thanks on a save", async () => {
    const { service, feedback, sessions } = setup();
    const createEventWithPrompt = vi.fn(() => Promise.resolve({ id: 'evt-1', ics: null }));
    service.native = true;
    service.calendar = { createEventWithPrompt } as unknown as typeof service.calendar;

    await service.add(session());

    expect(createEventWithPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Morning run', location: 'Parcul Central, Cluj-Napoca' }),
    );
    expect(feedback.success).toHaveBeenCalledWith('mySessions.toast.calendarAdded');
    expect(sessions.downloadIcs).not.toHaveBeenCalled();
  });

  it('says nothing when the person closes the screen without saving', async () => {
    const { service, feedback } = setup();
    service.native = true;
    service.calendar = {
      createEventWithPrompt: vi.fn(() => Promise.resolve({ id: null, ics: null })),
    } as unknown as typeof service.calendar;

    await service.add(session());
    expect(feedback.success).not.toHaveBeenCalled();
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it('says so when the calendar cannot open', async () => {
    const { service, feedback } = setup();
    service.native = true;
    service.calendar = {
      createEventWithPrompt: vi.fn(() => Promise.reject(new Error('no'))),
    } as unknown as typeof service.calendar;

    await service.add(session());
    expect(feedback.error).toHaveBeenCalledWith(expect.any(Error), 'mySessions.toast.calendarOpenFailed');
  });

  it('downloads the calendar file on the web', async () => {
    const { service, sessions } = setup();
    service.native = false;
    await service.add(session());
    expect(sessions.downloadIcs).toHaveBeenCalledWith('inst-1');
  });
});
