import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageAttachment } from 'core';

import { ShareCard } from './share-card';

describe('ShareCard', () => {
  const navigate = vi.fn(() => Promise.resolve(true));

  beforeEach(() => {
    navigate.mockClear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { url: '/tabs/messages/c-1', navigate } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(ShareCard, { set: { template: '', imports: [] } });
  });

  function card(attachment: MessageAttachment) {
    const fixture = TestBed.createComponent(ShareCard);
    fixture.componentRef.setInput('attachment', attachment);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const session = {
    type: 'SESSION' as const,
    id: 's-1',
    card: {
      type: 'SESSION' as const,
      state: 'AVAILABLE' as const,
      name: 'Morning yoga flow',
      startAt: '2027-01-09T07:00:00Z',
      endAt: '2027-01-09T08:00:00Z',
      durationMinutes: 60,
      timezone: 'Europe/Bucharest',
      online: false,
      placeName: 'Herăstrău',
      placeCity: 'București',
      capacity: 12,
      confirmedCount: 8,
      priceCents: null,
      currency: null,
    },
  };

  it('draws a session with its place and seats, and opens it in the chat stack', () => {
    const view = card(session);
    expect(view.sessionPlace()).toBe('Herăstrău');
    expect(view.seatsFill()).toBeCloseTo(8 / 12);
    expect(view.stripColor()).toBe('var(--ion-color-info)');
    view.open();
    expect(navigate).toHaveBeenCalledWith(['/tabs/messages/shared', 'session', 's-1']);
  });

  it('says online, never a place, for an online session', () => {
    const view = card({ ...session, card: { ...session.card, online: true } });
    expect(view.sessionPlace()).toBe('share.online');
  });

  it('opens nothing and greys out for something no longer available', () => {
    const view = card({
      type: 'GROUP',
      id: 'g-1',
      card: { type: 'GROUP', state: 'UNAVAILABLE', name: null },
    });
    expect(view.isUnavailable()).toBe(true);
    expect(view.group()).toBeNull();
    expect(view.stripColor()).toBe('var(--ion-color-medium)');
    view.open();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('names a starter a routine or a program', () => {
    const view = card({
      type: 'PROGRAM',
      id: 'p-1',
      card: {
        type: 'PROGRAM',
        state: 'AVAILABLE',
        name: 'Pull day',
        isSingleWorkout: true,
        level: 'BEGINNER',
        durationDays: null,
        workoutCount: 1,
        coverImageUrl: null,
      },
    });
    expect(view.programKind()).toBe('share.routine');
  });
});
