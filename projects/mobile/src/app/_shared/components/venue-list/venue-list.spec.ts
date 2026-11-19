import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { MeetingProvider, Venue, VenueKind } from 'core';

import { VenueActionIds, blankVenueDraft } from '../../config/venues.config';
import { CoachVenuesStore } from '../../services/coach-venues.store';
import { FeedbackService } from '../../services/feedback.service';
import { VenueList } from './venue-list';

const gym = { id: 'v-1', kind: VenueKind.GYM, name: 'FitZone', isActive: true } as Venue;

function setup() {
  const writes: Subject<Venue | void>[] = [];
  const reply = () => {
    const subject = new Subject<Venue | void>();
    writes.push(subject);
    return subject;
  };
  const store = {
    active: () => [gym],
    loaded: () => true,
    failed: () => false,
    ensureLoaded: vi.fn(),
    reload: vi.fn(),
    create: vi.fn(reply),
    update: vi.fn(reply),
    remove: vi.fn(reply),
  };
  const feedback = { success: vi.fn(() => Promise.resolve()), error: vi.fn(() => Promise.resolve()) };
  TestBed.configureTestingModule({
    providers: [
      { provide: CoachVenuesStore, useValue: store },
      { provide: FeedbackService, useValue: feedback },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const list = TestBed.runInInjectionContext(() => new VenueList());
  return { list, store, feedback, writes };
}

const online = { ...blankVenueDraft(), kind: VenueKind.ONLINE, name: 'Zoom', meetingProvider: MeetingProvider.ZOOM };

describe('VenueList', () => {
  it('adds a place, keeping the sheet open and locked until the API has it', () => {
    const { list, store, feedback, writes } = setup();
    list.add();

    list.save(online);
    expect(store.create).toHaveBeenCalledWith({
      kind: VenueKind.ONLINE,
      name: 'Zoom',
      meetingProvider: MeetingProvider.ZOOM,
    });
    expect(list.saving()).toBe(true);
    expect(list.sheetOpen()).toBe(true);

    writes[0].next(gym);
    expect(list.saving()).toBe(false);
    expect(list.sheetOpen()).toBe(false);
    expect(feedback.success).toHaveBeenCalledWith('venues.toast.added');
  });

  it('changes the place the sheet was opened on', () => {
    const { list, store } = setup();
    list.edit(gym);

    list.save(online);

    expect(store.update).toHaveBeenCalledWith('v-1', expect.objectContaining({ kind: VenueKind.ONLINE, meetingUrl: null }));
    expect(store.create).not.toHaveBeenCalled();
  });

  it('keeps the sheet open, filled in, when the save fails', () => {
    const { list, feedback, writes } = setup();
    list.add();
    list.save(online);

    writes[0].error(new Error('500'));

    expect(list.sheetOpen()).toBe(true);
    expect(list.saving()).toBe(false);
    expect(feedback.error).toHaveBeenCalled();
  });

  it('opens the place from its ⋯, or asks before removing it', () => {
    const { list } = setup();
    const event = { stopPropagation: vi.fn() } as unknown as Event;

    list.more(event, gym);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(list.actionsOpen()).toBe(true);

    list.onAction(VenueActionIds.Edit);
    expect(list.editing()).toBe(gym);
    expect(list.sheetOpen()).toBe(true);

    list.onAction(VenueActionIds.Remove);
    expect(list.removeOpen()).toBe(true);
  });

  it('removes the place once confirmed, and stays on the confirm when it fails', () => {
    const { list, store, writes } = setup();
    list.more({ stopPropagation: () => undefined } as unknown as Event, gym);
    list.onAction(VenueActionIds.Remove);

    list.remove();
    expect(store.remove).toHaveBeenCalledWith('v-1');
    writes[0].error(new Error('500'));
    expect(list.removeOpen()).toBe(true);

    list.remove();
    writes[1].next();
    expect(list.removeOpen()).toBe(false);
  });

  it('says the kind and what follows it on the second line', () => {
    const { list } = setup();
    expect(list.lineText({ icon: 'x', kindLabel: 'venues.kind.GYM', detail: 'Cluj', detailIsKey: false })).toBe(
      'venues.kind.GYM · Cluj',
    );
    expect(
      list.lineText({ icon: 'x', kindLabel: 'venues.kind.ONLINE', detail: 'venues.provider.OTHER', detailIsKey: true }),
    ).toBe('venues.kind.ONLINE · venues.provider.OTHER');
    expect(list.lineText({ icon: 'x', kindLabel: 'venues.kind.ONLINE', detail: null, detailIsKey: false })).toBe(
      'venues.kind.ONLINE',
    );
  });
});
