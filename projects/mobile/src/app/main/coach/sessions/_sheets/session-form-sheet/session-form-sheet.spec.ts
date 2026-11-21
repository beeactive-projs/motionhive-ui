import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CreateTemplateRequest,
  GroupService,
  SessionService,
  SessionTemplate,
  SessionsInstructorStore,
  UpdateTemplateRequest,
  Venue,
  VenueService,
} from 'core';

import { VenueDraft } from '../../../../../_shared/config/venues.config';
import { CoachVenuesStore } from '../../../../../_shared/services/coach-venues.store';
import { FeedbackService } from '../../../../../_shared/services/feedback.service';
import { SessionFormSheet } from './session-form-sheet';

/** A template as the detail page hands it to the edit sheet. */
function template(overrides: Partial<SessionTemplate> = {}): SessionTemplate {
  return {
    id: 't-1',
    instructorId: 'u-1',
    groupId: 'g-1',
    venueId: 'v-1',
    slug: 'strength',
    title: 'Strength club',
    description: null,
    type: 'GROUP',
    access: 'OPEN',
    approvalRequired: false,
    locationKind: 'IN_PERSON',
    meetingUrl: null,
    meetingProvider: null,
    durationMinutes: 60,
    timezone: 'Europe/Bucharest',
    capacity: 12,
    waitlistEnabled: true,
    cancellationCutoffHours: 24,
    // Paid, so priced: a "Paid" session with no price cannot be saved.
    priceAmountCents: 4950,
    priceCurrency: 'RON',
    isRecurring: true,
    recurrenceRule: { frequency: 'WEEKLY', interval: 1, daysOfWeek: [1, 3], endAfterOccurrences: 8 },
    firstStartAt: '2030-11-21T16:00:00.000Z',
    status: 'ACTIVE',
    endedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('SessionFormSheet', () => {
  let createTemplate: ReturnType<typeof vi.fn>;
  let updateTemplate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createTemplate = vi.fn(() => of({ template: template(), generatedInstances: [], warnings: [] }));
    updateTemplate = vi.fn(() => of(template()));
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        {
          provide: SessionService,
          useValue: {
            createTemplate,
            updateTemplate,
            previewRecurrence: () => of({ occurrences: [], truncated: false }),
          },
        },
        { provide: VenueService, useValue: { list: () => of([]) } },
        { provide: CoachVenuesStore, useValue: { create: vi.fn() } },
        { provide: GroupService, useValue: { getMyGroups: () => of([]) } },
        { provide: FeedbackService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: SessionsInstructorStore, useValue: { rangeInstances: signal([]) } },
      ],
    });
    TestBed.overrideComponent(SessionFormSheet, { set: { template: '', imports: [] } });
  });

  /** The sheet opened, seeded from `editing` when given. */
  function open(editing: SessionTemplate | null = null): SessionFormSheet {
    const fixture = TestBed.createComponent(SessionFormSheet);
    fixture.componentRef.setInput('template', editing);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  function created(): CreateTemplateRequest {
    return createTemplate.mock.calls[0][0] as CreateTemplateRequest;
  }

  function updated(): UpdateTemplateRequest {
    return updateTemplate.mock.calls[0][1] as UpdateTemplateRequest;
  }

  // In person with no place to pick: the coach adds one here and it is chosen.
  // With places already, the picker's last option adds another one in place.
  describe('adding a place from the picker', () => {
    it('opens the place sheet and keeps the picker on what it showed', () => {
      const sheet = open();
      sheet.venueId.set('v-1');
      const select = { value: 'add-place' as unknown };
      sheet.onVenueChange(sheet.addPlaceOption, select);

      expect(sheet.placeOpen()).toBe(true);
      expect(select.value).toBe('v-1');
      expect(sheet.venueId()).toBe('v-1');
    });

    it('takes an ordinary pick as the venue', () => {
      const sheet = open();
      sheet.onVenueChange('v-2', { value: 'v-2' });
      expect(sheet.venueId()).toBe('v-2');
      expect(sheet.placeOpen()).toBe(false);
    });
  });

  describe('no places yet', () => {
    it('counts only places with an address: an online room is no answer to "where"', () => {
      const sheet = open();
      sheet.venues.set([{ id: 'v-online', name: 'Zoom', isOnline: true, isActive: true } as Venue]);
      expect(sheet.physicalVenues()).toEqual([]);
      expect(sheet.needsPlace()).toBe(true);
    });

    it('says so in person, not online', () => {
      const sheet = open();
      expect(sheet.needsPlace()).toBe(true);
      sheet.locationKind.set('ONLINE');
      expect(sheet.needsPlace()).toBe(false);
    });

    it('adds a place through the shared store and picks it for this session', () => {
      const venues = TestBed.inject(CoachVenuesStore) as unknown as { create: ReturnType<typeof vi.fn> };
      venues.create.mockReturnValue(
        of({ id: 'v-1', name: 'Parcul Central', isOnline: false, isActive: true } as Venue),
      );
      const sheet = open();
      sheet.placeOpen.set(true);
      sheet.addPlace({
        kind: 'PARK',
        name: 'Parcul Central',
        place: null,
        meetingProvider: null,
        meetingUrl: '',
        travelRadiusKm: null,
      } as VenueDraft);

      expect(venues.create).toHaveBeenCalledWith(expect.objectContaining({ kind: 'PARK', name: 'Parcul Central' }));
      expect(sheet.venueId()).toBe('v-1');
      expect(sheet.placeOpen()).toBe(false);
      expect(sheet.needsPlace()).toBe(false);
    });
  });

  describe('a 1-on-1', () => {
    it('is created with one seat', () => {
      const sheet = open();
      sheet.title.set('Coaching call');
      sheet.priceAmount.set(50);
      sheet.type.set('PRIVATE');
      sheet.capacity.set(12);
      sheet.save();
      expect(created().capacity).toBe(1);
    });

    it('keeps one seat when edited', () => {
      const sheet = open(template({ type: 'PRIVATE', capacity: null, isRecurring: false }));
      sheet.save();
      expect(updated().capacity).toBe(1);
    });
  });

  describe('an edit', () => {
    // Omitting a field keeps the old value, so a cleared field must say null.
    it('clears the venue, the seat limit, the group and the link with null', () => {
      const sheet = open(template({ type: 'OPEN' }));
      sheet.venueId.set(null);
      sheet.capacity.set(null);
      sheet.save();
      expect(updated()).toMatchObject({
        venueId: null,
        capacity: null,
        groupId: null,
        meetingUrl: null,
      });
    });

    it('keeps a group the picker still offers', () => {
      const sheet = open(template());
      sheet.save();
      expect(updated().groupId).toBe('g-1');
    });

    it('drops the venue when the session moves online, with the link made whole', () => {
      const sheet = open(template({ isRecurring: false, recurrenceRule: null }));
      sheet.locationKind.set('ONLINE');
      sheet.meetingUrl.set('meet.google.com/abc-defg-hij');
      sheet.save();
      expect(updated()).toMatchObject({
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
        venueId: null,
      });
    });

    // The API applies these to the template only, never to the dates
    // already created, so they are locked and stay off the PATCH.
    it('sends neither the timezone nor the repeat rule, and keeps the duration', () => {
      const sheet = open(template());
      sheet.durationMinutes.set(75);
      sheet.save();
      expect(updated().durationMinutes).toBe(75);
      expect('timezone' in updated()).toBe(false);
      expect('recurrenceRule' in updated()).toBe(false);
    });

    it('says what is locked, with the days and end on a series', () => {
      expect(open(template()).scheduleLockedHint()).toBe('sessions.form.scheduleLocked');
      expect(open(template()).startError()).toBeNull();
    });

    it("shows the start on the template's own clock", () => {
      const sheet = open(template({ timezone: 'Europe/London' }));
      expect(sheet.startAt()).toBe('2030-11-21T16:00');
      expect(sheet.startIso()).toBe('2030-11-21T16:00:00.000Z');
    });
  });

  describe('the timezone', () => {
    // 18:00 picked for London on a phone anywhere is 18:00 in London.
    it('reads the picked time in the picked zone', () => {
      const sheet = open();
      sheet.title.set('Evening run');
      sheet.priceAmount.set(50);
      sheet.startAt.set('2030-11-21T18:00');
      sheet.timezone.set('Europe/London');
      sheet.save();
      expect(created().firstStartAt).toBe('2030-11-21T18:00:00.000Z');
      expect(created().timezone).toBe('Europe/London');

      sheet.timezone.set('Europe/Bucharest');
      expect(sheet.startIso()).toBe('2030-11-21T16:00:00.000Z');
    });
  });

  // OPEN started with an empty price, so "Paid" sat beside a free price, and
  // FREE still took one.
  describe('access and price', () => {
    it('starts a new session free, so Create works with no price', () => {
      const sheet = open();
      sheet.title.set('Yoga');
      expect(sheet.access()).toBe('FREE');
      expect(sheet.canSave()).toBe(true);
    });

    it('wants a price above zero on a paid session, said once the field is left', () => {
      const sheet = open();
      sheet.title.set('Yoga');
      sheet.access.set('OPEN');
      expect(sheet.canSave()).toBe(false);
      expect(sheet.priceError()).toBeNull();

      sheet.priceTouched.set(true);
      expect(sheet.priceError()).toBe('sessions.form.errors.price');
      sheet.priceAmount.set(0);
      expect(sheet.priceError()).not.toBeNull();

      sheet.priceAmount.set(49.5);
      expect(sheet.priceError()).toBeNull();
      expect(sheet.canSave()).toBe(true);
      sheet.save();
      expect(created()).toMatchObject({ priceAmountCents: 4950, priceCurrency: 'RON' });
    });

    it('hides the price for Free and sends none', () => {
      const sheet = open();
      sheet.title.set('Park run');
      sheet.priceAmount.set(20);
      sheet.access.set('FREE');
      expect(sheet.showPrice()).toBe(false);
      expect(sheet.canSave()).toBe(true);
      sheet.save();
      expect('priceAmountCents' in created()).toBe(false);
      expect('priceCurrency' in created()).toBe(false);
    });

    it('clears the price of a session made Free', () => {
      const sheet = open(template({ priceAmountCents: 4950 }));
      sheet.access.set('FREE');
      sheet.save();
      expect(updated().priceAmountCents).toBe(0);
    });

    it('keeps the price optional for clients only and group members', () => {
      const sheet = open();
      sheet.title.set('Clients circuit');
      sheet.access.set('CLIENTS_ONLY');
      expect(sheet.priceOptional()).toBe(true);
      expect(sheet.canSave()).toBe(true);
      sheet.save();
      expect('priceAmountCents' in created()).toBe(false);
    });

    // The mark sits in the field's own label, and only where it can be left empty.
    it('marks the price optional in its label only where empty means free', () => {
      const sheet = open();
      sheet.access.set('OPEN');
      expect(sheet.priceLabel()).toBe('form.label.price');
      sheet.access.set('CLIENTS_ONLY');
      expect(sheet.priceLabel()).toBe('form.label.price form.hint.optional');
      sheet.access.set('GROUP_ONLY');
      expect(sheet.priceLabel()).toBe('form.label.price form.hint.optional');
    });

    // An old "Paid" session with no price opens with the reason Save is off.
    it('says so at once when an unpriced paid session is edited', () => {
      const sheet = open(template({ access: 'OPEN', priceAmountCents: 0 }));
      expect(sheet.priceError()).toBe('sessions.form.errors.price');
      expect(sheet.canSave()).toBe(false);
    });
  });

  describe('checks before the API', () => {
    it('wants a whole seat count from 1 to 1000, or none', () => {
      const sheet = open();
      sheet.priceAmount.set(50);
      sheet.title.set('Yoga');
      sheet.capacity.set(0);
      expect(sheet.capacityError()).toBe('sessions.form.errors.capacity');
      expect(sheet.canSave()).toBe(false);
      sheet.capacity.set(1001);
      expect(sheet.capacityError()).not.toBeNull();
      sheet.capacity.set(null);
      expect(sheet.capacityError()).toBeNull();
      expect(sheet.canSave()).toBe(true);
    });

    it('names a link that cannot be an https one once the field is left', () => {
      const sheet = open();
      sheet.priceAmount.set(50);
      sheet.title.set('Online yoga');
      sheet.locationKind.set('ONLINE');
      sheet.meetingUrl.set('zoom');
      expect(sheet.meetingLinkError()).toBeNull();
      expect(sheet.canSave()).toBe(false);

      sheet.onMeetingBlur();
      expect(sheet.meetingLinkError()).toBe('sessions.form.errors.meetingLink');

      sheet.meetingUrl.set('zoom.us/j/123');
      sheet.onMeetingBlur();
      expect(sheet.meetingUrl()).toBe('https://zoom.us/j/123');
      expect(sheet.meetingLinkError()).toBeNull();
      expect(sheet.canSave()).toBe(true);
    });

    it('refuses a series that ends before it starts', () => {
      const sheet = open();
      sheet.title.set('Yoga');
      sheet.startAt.set('2030-11-21T18:00');
      sheet.isRecurring.set(true);
      sheet.daysOfWeek.set([4]);
      sheet.endMode.set('onDate');
      sheet.endDate.set('2030-11-20');
      expect(sheet.endDateError()).toBe('sessions.form.errors.endBeforeStart');
      expect(sheet.canSave()).toBe(false);
      sheet.endDate.set('2030-12-20');
      expect(sheet.endDateError()).toBeNull();
    });

    it('refuses a start that has passed, with the picker floored at now', () => {
      const sheet = open();
      sheet.title.set('Yoga');
      sheet.startAt.set('2020-01-01T09:00');
      expect(sheet.startError()).toBe('sessions.form.errors.startPast');
      expect(sheet.canSave()).toBe(false);
      sheet.save();
      expect(createTemplate).not.toHaveBeenCalled();
      expect(sheet.startMin() > '2026-01-01').toBe(true);
    });
  });
});
