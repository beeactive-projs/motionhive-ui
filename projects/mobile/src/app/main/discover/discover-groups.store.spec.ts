import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { DiscoverGroup, GroupService } from 'core';

import { DiscoverGroupsStore } from './discover.store';

function group(id: string, city: string | null = null): DiscoverGroup {
  return { id, name: id, city } as DiscoverGroup;
}

function setup() {
  const discoverGroups = vi.fn((_query: { city?: string; categoryIds?: string[] }) =>
    of({ items: [group('g1', 'Cluj')], total: 1, page: 1, pageSize: 50 }),
  );
  TestBed.configureTestingModule({
    providers: [DiscoverGroupsStore, { provide: GroupService, useValue: { discoverGroups } }],
  });
  return { store: TestBed.inject(DiscoverGroupsStore), discoverGroups };
}

describe('DiscoverGroupsStore, the narrowed read', () => {
  // The cards were the 50 biggest groups filtered on the phone: a Cluj
  // reader got nothing while Cluj groups sat further down the list.
  it('asks the server for the city', () => {
    const { store, discoverGroups } = setup();
    store.useTopic(null, 'Cluj');
    expect(discoverGroups).toHaveBeenCalledWith({ categoryIds: [], page: 1, limit: 50, city: 'Cluj' });
    expect(store.topicGroups().map((g) => g.id)).toEqual(['g1']);
  });

  it('asks for the city and the topic together', () => {
    const { store, discoverGroups } = setup();
    store.useTopic(['c2', 'c1'], 'Cluj');
    expect(discoverGroups.mock.lastCall?.[0]).toMatchObject({ categoryIds: ['c2', 'c1'], city: 'Cluj' });
  });

  it('asks again only when the city or the topic changes', () => {
    const { store, discoverGroups } = setup();
    store.useTopic(['c1', 'c2'], 'Cluj');
    store.useTopic(['c2', 'c1'], 'Cluj');
    expect(discoverGroups).toHaveBeenCalledTimes(1);
    store.useTopic(['c1', 'c2'], 'Iasi');
    expect(discoverGroups).toHaveBeenCalledTimes(2);
  });

  it('asks for nothing with neither, and leaves a topic alone without a city', () => {
    const { store, discoverGroups } = setup();
    store.useTopic(null, null);
    expect(discoverGroups).not.toHaveBeenCalled();
    store.useTopic(['c1']);
    expect(discoverGroups.mock.lastCall?.[0]).not.toHaveProperty('city');
  });
});
