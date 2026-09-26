import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  DiscoverGroup,
  DiscoverGroupListResponse,
  Group,
  GroupService,
  Post,
  PostService,
} from 'core';

import { GroupsSegments } from './groups.filters';
import { GroupsStore } from './groups.store';

function group(id: string, name = `Group ${id}`): Group {
  return { id, name, memberCount: 3 } as Group;
}

function discoverGroup(id: string): DiscoverGroup {
  return group(id) as DiscoverGroup;
}

function post(id: string): Post {
  return { id, content: 'hello', reactionCount: 0, commentCount: 0 } as Post;
}

function page<T>(items: T[], total = items.length) {
  return { items, total, page: 1, pageSize: 20 };
}

interface Fixtures {
  feed?: ReturnType<typeof page<Post>>;
  discover?: ReturnType<typeof page<DiscoverGroup>>;
  mine?: Group[];
}

function setup(fixtures: Fixtures = {}) {
  const getFeed = vi.fn(() => of(fixtures.feed ?? page<Post>([])));
  const discoverGroups = vi.fn(
    () => of((fixtures.discover ?? page<DiscoverGroup>([])) as DiscoverGroupListResponse),
  );
  const getMyGroups = vi.fn(() => of(fixtures.mine ?? []));

  TestBed.configureTestingModule({
    providers: [
      GroupsStore,
      { provide: GroupService, useValue: { discoverGroups, getMyGroups } },
      { provide: PostService, useValue: { getFeed } },
    ],
  });

  return { store: TestBed.inject(GroupsStore), getFeed, discoverGroups, getMyGroups };
}

describe('GroupsStore — what loads when', () => {
  it('loads only the lens on screen, plus the memberships the feed needs', () => {
    // The feed's empty state asks "have you joined anything?", which only the
    // memberships answer — so the feed pulls both. Discover is not touched.
    const { store, getFeed, getMyGroups, discoverGroups } = setup();

    store.load();

    expect(getFeed).toHaveBeenCalledTimes(1);
    expect(getMyGroups).toHaveBeenCalledTimes(1);
    expect(discoverGroups).not.toHaveBeenCalled();
  });

  it('does not refetch a lens it already has', () => {
    const { store, getFeed } = setup({ feed: page([post('p1')]) });

    store.load();
    store.load();

    expect(getFeed).toHaveBeenCalledTimes(1);
  });

  it('refetches when forced', () => {
    const { store, getFeed } = setup({ feed: page([post('p1')]) });

    store.load();
    store.refresh();

    expect(getFeed).toHaveBeenCalledTimes(2);
  });

  it('loads a lens the first time it is switched to, and not again', () => {
    const { store, discoverGroups } = setup({ discover: page([discoverGroup('g1')]) });

    store.setSegment(GroupsSegments.Discover);
    store.setSegment(GroupsSegments.Mine);
    store.setSegment(GroupsSegments.Discover);

    expect(discoverGroups).toHaveBeenCalledTimes(1);
  });

  it('leaves a freshly loaded lens alone on re-entry', () => {
    // Stepping into a group and straight back out should not re-fire the
    // list for data seconds old.
    const { store, getFeed } = setup({ feed: page([post('p1')]) });

    store.load();
    store.reenter();

    expect(getFeed).toHaveBeenCalledTimes(1);
  });

  it('refetches on re-entry once the freshness window has passed', () => {
    const { store, getFeed } = setup({ feed: page([post('p1')]) });
    store.load();

    // Past the 15s window — a group joined or posted in elsewhere has to be
    // picked up.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 20_000);
    store.reenter();
    vi.restoreAllMocks();

    expect(getFeed).toHaveBeenCalledTimes(2);
  });
});

describe('GroupsStore — Discover search', () => {
  it('does not ask the API for a term below the floor', () => {
    const { store, discoverGroups } = setup();
    store.setSegment(GroupsSegments.Discover);
    discoverGroups.mockClear();

    store.setQuery('a');

    expect(discoverGroups).not.toHaveBeenCalled();
    expect(store.queryTooShort()).toBe(true);
  });

  it('searches once the term reaches the floor', () => {
    const { store, discoverGroups } = setup();
    store.setSegment(GroupsSegments.Discover);
    discoverGroups.mockClear();

    store.setQuery('yo');

    expect(discoverGroups).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'yo', page: 1 }),
    );
  });

  it('does not re-search when the term the API would see has not changed', () => {
    // 'a' → 'ab' is a real change; 'a' → 'b' is not, both being below the
    // floor and so both meaning "no search term".
    const { store, discoverGroups } = setup();
    store.setSegment(GroupsSegments.Discover);
    discoverGroups.mockClear();

    store.setQuery('a');
    store.setQuery('b');

    expect(discoverGroups).not.toHaveBeenCalled();
  });

  it('resets rows on a new term so pages cannot interleave', () => {
    const { store, discoverGroups } = setup({ discover: page([discoverGroup('g1')]) });
    store.setSegment(GroupsSegments.Discover);
    expect(store.discover()).toHaveLength(1);

    discoverGroups.mockReturnValueOnce(of(page([discoverGroup('g2')])));
    store.setQuery('yoga');

    expect(store.discover().map((g) => g.id)).toEqual(['g2']);
  });

  it('ignores a slow response for a term that was abandoned', () => {
    // The guard this exists for: type 'yoga', then 'pilates'; the first
    // response lands last and must not become the visible answer.
    const slow = new Subject<DiscoverGroupListResponse>();
    const { store, discoverGroups } = setup();
    store.setSegment(GroupsSegments.Discover);

    discoverGroups.mockReturnValueOnce(slow.asObservable());
    store.setQuery('yoga');

    discoverGroups.mockReturnValueOnce(of(page([discoverGroup('pilates-hit')])));
    store.setQuery('pilates');

    slow.next(page([discoverGroup('yoga-hit')]));
    slow.complete();

    expect(store.discover().map((g) => g.id)).toEqual(['pilates-hit']);
  });

  it('clears back to the unsearched directory', () => {
    const { store, discoverGroups } = setup();
    store.setSegment(GroupsSegments.Discover);
    store.setQuery('yoga');
    discoverGroups.mockClear();

    store.clearQuery();

    expect(store.query()).toBe('');
    expect(discoverGroups).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined }),
    );
  });
});

describe('GroupsStore — paging', () => {
  it('appends the next page rather than replacing', () => {
    const { store, getFeed } = setup({ feed: page([post('p1')], 2) });
    store.loadFeed();

    getFeed.mockReturnValueOnce(of({ items: [post('p2')], total: 2, page: 2, pageSize: 20 }));
    store.loadMoreFeed();

    expect(store.feed().map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(store.feedHasMore()).toBe(false);
  });

  it('does not page past the total', () => {
    const { store, getFeed } = setup({ feed: page([post('p1')], 1) });
    store.loadFeed();
    getFeed.mockClear();

    store.loadMoreFeed();

    expect(getFeed).not.toHaveBeenCalled();
  });
});

describe('GroupsStore — failure', () => {
  it('reports a failed first load with nothing to show', () => {
    const { store, getFeed } = setup();
    getFeed.mockReturnValueOnce(throwError(() => new Error('offline')));

    store.loadFeed();

    expect(store.showLoadError()).toBe(true);
    expect(store.isStale()).toBe(false);
  });

  it('keeps the rows it has and marks them stale when a refresh fails', () => {
    const { store, getFeed } = setup({ feed: page([post('p1')]) });
    store.loadFeed();

    getFeed.mockReturnValueOnce(throwError(() => new Error('offline')));
    store.refresh();

    expect(store.feed().map((p) => p.id)).toEqual(['p1']);
    expect(store.isStale()).toBe(true);
    expect(store.showLoadError()).toBe(false);
  });

  it('keeps earlier pages when a later one fails', () => {
    const { store, getFeed } = setup({ feed: page([post('p1')], 2) });
    store.loadFeed();

    getFeed.mockReturnValueOnce(throwError(() => new Error('offline')));
    store.loadMoreFeed();

    expect(store.feed().map((p) => p.id)).toEqual(['p1']);
    expect(store.isStale()).toBe(false);
  });

  it('always calls done, so a refresher spinner cannot hang', () => {
    const { store, getFeed } = setup();
    getFeed.mockReturnValueOnce(throwError(() => new Error('offline')));
    const done = vi.fn();

    store.refresh(done);

    expect(done).toHaveBeenCalled();
  });

  it('calls done even when the load is skipped as already fresh', () => {
    const { store } = setup({ feed: page([post('p1')]) });
    store.loadFeed();
    const done = vi.fn();

    store.loadFeed({ done });

    expect(done).toHaveBeenCalled();
  });
});

describe('GroupsStore — empty states', () => {
  it('separates "nothing here" from "nothing matches"', () => {
    const { store } = setup({ discover: page<DiscoverGroup>([]) });
    store.setSegment(GroupsSegments.Discover);

    expect(store.isEmpty()).toBe(true);
    expect(store.isFilteredEmpty()).toBe(false);

    store.setQuery('yoga');

    expect(store.isFilteredEmpty()).toBe(true);
  });

  it('does not claim a search found nothing while the term is below the floor', () => {
    // Caught on screen: one character typed put "No public group matches
    // that" under a hint still asking for a second one. No request had run.
    const { store } = setup({ discover: page<DiscoverGroup>([]) });
    store.setSegment(GroupsSegments.Discover);

    store.setQuery('a');

    expect(store.isFilteredEmpty()).toBe(false);
  });

  it('counts memberships so the feed can pick its empty state', () => {
    const { store } = setup({ mine: [group('g1'), group('g2')] });

    store.load();

    expect(store.myGroupCount()).toBe(2);
  });
});
