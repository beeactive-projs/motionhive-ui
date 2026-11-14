import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  GroupMemberRole,
  GroupService,
  GroupWithMyRole,
  GroupsRefreshService,
  PendingGroupInvitation,
  Post,
  PostService,
} from 'core';

import { GroupsSegments } from './groups.filters';
import { GroupsStore } from './groups.store';

function group(
  id: string,
  myRole: GroupMemberRole,
  extra: Partial<GroupWithMyRole> = {},
): GroupWithMyRole {
  return { id, name: `Group ${id}`, memberCount: 3, myRole, ...extra } as GroupWithMyRole;
}

function post(id: string, groupId = 'g1'): Post {
  return { id, groupId, content: 'hello', reactionCount: 0, commentCount: 0, myReaction: null } as Post;
}

function invitation(id: string): PendingGroupInvitation {
  return {
    id,
    message: null,
    createdAt: '',
    expiresAt: '',
    inviter: null,
    group: { id: `g-${id}`, name: 'Crew', slug: 'crew', logoUrl: null, description: null, memberCount: 2, categoryIds: [] },
  };
}

function page<T>(items: T[], total = items.length) {
  return { items, total, page: 1, pageSize: 20 };
}

interface Fixtures {
  feed?: ReturnType<typeof page<Post>>;
  mine?: GroupWithMyRole[];
  invitations?: PendingGroupInvitation[];
}

function setup(fixtures: Fixtures = {}) {
  const getFeed = vi.fn(() => of(fixtures.feed ?? page<Post>([])));
  const getMyGroups = vi.fn(() => of(fixtures.mine ?? []));
  const getMyInvitations = vi.fn(() => of(page(fixtures.invitations ?? [])));
  const acceptInvitation = vi.fn(() => of({ groupId: 'g-new' }));
  const declineInvitation = vi.fn(() => of(undefined));
  const toggleReaction = vi.fn(() => of({ reacted: true, count: 1 }));
  const notify = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      GroupsStore,
      {
        provide: GroupService,
        useValue: { getMyGroups, getMyInvitations, acceptInvitation, declineInvitation },
      },
      { provide: PostService, useValue: { getFeed, toggleReaction } },
      { provide: GroupsRefreshService, useValue: { refresh$: of(), notify } },
    ],
  });

  return {
    store: TestBed.inject(GroupsStore),
    getFeed,
    getMyGroups,
    getMyInvitations,
    acceptInvitation,
    declineInvitation,
    toggleReaction,
    notify,
  };
}

describe('GroupsStore: what loads when', () => {
  it('loads the feed with your groups and your invitations', () => {
    // "Needs you", the empty state and each post's ⋯ all read your groups.
    const { store, getFeed, getMyGroups, getMyInvitations } = setup();

    store.load();

    expect(getFeed).toHaveBeenCalledTimes(1);
    expect(getMyGroups).toHaveBeenCalledTimes(1);
    expect(getMyInvitations).toHaveBeenCalledTimes(1);
  });

  it('does not refetch a feed it already has', () => {
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

  it('Your groups loads without the feed', () => {
    const { store, getFeed, getMyGroups } = setup();

    store.setSegment(GroupsSegments.Mine);

    expect(getMyGroups).toHaveBeenCalledTimes(1);
    expect(getFeed).not.toHaveBeenCalled();
  });

  it('leaves a seconds-old load alone on re-entry', () => {
    const { store, getFeed } = setup({ feed: page([post('p1')]) });

    store.load();
    store.reenter();

    expect(getFeed).toHaveBeenCalledTimes(1);
  });

  it('keeps old rows and says they are stale when a refresh fails', () => {
    const { store, getFeed } = setup({ feed: page([post('p1')]) });
    store.load();
    getFeed.mockReturnValueOnce(throwError(() => new Error('offline')));

    store.refresh();

    expect(store.feed()).toHaveLength(1);
    expect(store.isStale()).toBe(true);
    expect(store.showLoadError()).toBe(false);
  });
});

describe('GroupsStore: Your groups', () => {
  const mine = [
    group('a', 'MEMBER', { lastPostAt: '2026-11-10T00:00:00Z' }),
    group('b', 'OWNER', { lastPostAt: '2026-11-01T00:00:00Z', pendingJoinRequestCount: 2 }),
    group('c', 'OWNER', { lastPostAt: '2026-11-12T00:00:00Z' }),
    group('d', 'MODERATOR', { pendingPostCount: 1 }),
  ];

  it('splits the groups you run from the ones you joined, newest post first', () => {
    const { store } = setup({ mine });
    store.setSegment(GroupsSegments.Mine);

    expect(store.run().map((row) => row.id)).toEqual(['c', 'b']);
    expect(store.joined().map((row) => row.id)).toEqual(['a', 'd']);
  });

  it('lists the groups with work waiting on you under Needs you', () => {
    const { store } = setup({ mine });
    store.load();

    expect(store.needsYou().map((row) => row.id)).toEqual(['b', 'd']);
  });
});

describe('GroupsStore: changes made on the page', () => {
  it('patches a like into the feed from the answer', () => {
    const { store } = setup({ feed: page([post('p1')]) });
    store.load();

    store.toggleReaction(store.feed()[0]).subscribe();

    expect(store.feed()[0].reactionCount).toBe(1);
    expect(store.feed()[0].myReaction).toBe('LIKE');
  });

  it('drops a deleted post and its count', () => {
    const { store } = setup({ feed: page([post('p1'), post('p2')], 2) });
    store.load();

    store.removePost('p1');

    expect(store.feed().map((row) => row.id)).toEqual(['p2']);
    expect(store.feedHasMore()).toBe(false);
  });

  it('takes an accepted invitation away and refreshes the lists', () => {
    const { store, acceptInvitation, notify, getMyGroups, getMyInvitations } = setup({
      invitations: [invitation('i1'), invitation('i2')],
    });
    store.load();
    const before = getMyGroups.mock.calls.length;
    // The server stops listing it once accepted.
    getMyInvitations.mockReturnValue(of(page([invitation('i2')])));

    store.acceptInvitation(store.invitations()[0]).subscribe();

    expect(acceptInvitation).toHaveBeenCalledWith('i1');
    expect(store.invitations().map((row) => row.id)).toEqual(['i2']);
    expect(notify).toHaveBeenCalled();
    expect(getMyGroups.mock.calls.length).toBeGreaterThan(before);
  });

  it('takes a declined invitation away', () => {
    const { store, declineInvitation } = setup({ invitations: [invitation('i1')] });
    store.load();

    store.declineInvitation(store.invitations()[0]).subscribe();

    expect(declineInvitation).toHaveBeenCalledWith('i1');
    expect(store.invitations()).toHaveLength(0);
  });
});
