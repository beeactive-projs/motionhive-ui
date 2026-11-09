import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable, Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AuthStore, Venue, VenueKind, VenueService } from 'core';

import { CoachVenuesStore } from './coach-venues.store';

function venue(id: string, fields: Partial<Venue> = {}): Venue {
  return { id, kind: VenueKind.GYM, name: id, isActive: true, ...fields } as Venue;
}

function setup() {
  const user = signal<{ id: string } | null>({ id: 'coach-1' });
  const lists: Subject<Venue[]>[] = [];
  const service = {
    list: vi.fn((): Observable<Venue[]> => {
      const reply = new Subject<Venue[]>();
      lists.push(reply);
      return reply;
    }),
    create: vi.fn((payload: { name: string }): Observable<Venue> =>
      of(venue('new', { name: payload.name })),
    ),
    update: vi.fn((id: string, payload: { name: string }) => of(venue(id, { name: payload.name }))),
    remove: vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [
      CoachVenuesStore,
      { provide: VenueService, useValue: service },
      { provide: AuthStore, useValue: { user } },
    ],
  });
  const store = TestBed.inject(CoachVenuesStore);
  const answer = (index: number, venues: Venue[]) => {
    lists[index].next(venues);
    lists[index].complete();
  };
  return { store, service, user, answer, lists };
}

describe('CoachVenuesStore', () => {
  it('loads once, quietly, and keeps the list for every screen', () => {
    const { store, service, answer } = setup();

    store.ensureLoaded();
    store.ensureLoaded();
    expect(service.list).toHaveBeenCalledOnce();
    expect(service.list).toHaveBeenCalledWith({ silent: true });

    answer(0, [venue('a'), venue('b')]);
    store.ensureLoaded();

    expect(service.list).toHaveBeenCalledOnce();
    expect(store.loaded()).toBe(true);
    expect(store.venues().map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('leaves archived places off the profile list', () => {
    const { store, answer } = setup();
    store.ensureLoaded();
    answer(0, [venue('a'), venue('old', { isActive: false })]);

    expect(store.active().map((entry) => entry.id)).toEqual(['a']);
  });

  it('says a failed load failed, and tries again on reload', () => {
    const { store, service } = setup();
    service.list.mockReturnValueOnce(throwError(() => new Error('offline')));

    store.ensureLoaded();
    expect(store.failed()).toBe(true);
    expect(store.loaded()).toBe(false);

    store.reload();
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(store.failed()).toBe(false);
  });

  it('adds, changes and removes a place only once the API has it', () => {
    const { store, service, answer } = setup();
    store.ensureLoaded();
    answer(0, [venue('a')]);

    store.create({ kind: VenueKind.ONLINE, name: 'Zoom' }).subscribe();
    expect(store.venues().map((entry) => entry.name)).toEqual(['a', 'Zoom']);

    store.update('a', { name: 'FitZone' }).subscribe();
    expect(store.venues().map((entry) => entry.name)).toEqual(['FitZone', 'Zoom']);

    store.remove('a').subscribe();
    expect(store.venues().map((entry) => entry.id)).toEqual(['new']);
    expect(service.remove).toHaveBeenCalledWith('a');
  });

  it('keeps the list as it was when a write fails', () => {
    const { store, service, answer } = setup();
    store.ensureLoaded();
    answer(0, [venue('a')]);
    service.create.mockReturnValueOnce(throwError(() => new Error('400')));

    store.create({ kind: VenueKind.GYM, name: 'FitZone' }).subscribe({ error: () => undefined });

    expect(store.venues().map((entry) => entry.id)).toEqual(['a']);
  });

  it("starts over for another account, and drops an answer that came for the last one", () => {
    const { store, service, user, answer } = setup();
    store.ensureLoaded();

    user.set({ id: 'coach-2' });
    answer(0, [venue('not-yours')]);
    expect(store.venues()).toEqual([]);

    store.ensureLoaded();
    expect(service.list).toHaveBeenCalledTimes(2);
    answer(1, [venue('mine')]);
    expect(store.venues().map((entry) => entry.id)).toEqual(['mine']);
  });
});
