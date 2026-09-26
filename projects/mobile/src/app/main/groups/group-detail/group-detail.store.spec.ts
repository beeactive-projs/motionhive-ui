import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  GroupMember,
  GroupMemberRole,
  GroupMemberRoles,
  GroupService,
  GroupWithMyRole,
  Post,
  PostService,
} from 'core';

import { GroupTabs } from '../groups.filters';
import { GroupDetailStore } from './group-detail.store';

const GROUP_ID = 'g-1';

function group(overrides: Partial<GroupWithMyRole> = {}): GroupWithMyRole {
  return {
    id: GROUP_ID,
    name: 'Morning Crew',
    memberCount: 4,
    myRole: GroupMemberRoles.Member,
    ...overrides,
  } as GroupWithMyRole;
}

function member(userId: string, role: GroupMemberRole = GroupMemberRoles.Member): GroupMember {
  return {
    id: `m-${userId}`,
    userId,
    role,
    user: { firstName: 'Anna', lastName: 'Popescu', email: `${userId}@motionhive.fit` },
  } as GroupMember;
}

function post(id: string, overrides: Partial<Post> = {}): Post {
  return { id, content: 'hello', reactionCount: 0, commentCount: 0, ...overrides } as Post;
}

function page<T>(items: T[], total = items.length) {
  return { items, total, page: 1, pageSize: 20 };
}

interface Fixtures {
  group?: GroupWithMyRole;
  posts?: ReturnType<typeof page<Post>>;
  members?: ReturnType<typeof page<GroupMember>>;
}

function setup(fixtures: Fixtures = {}) {
  const getById = vi.fn(() => of(fixtures.group ?? group()));
  const getMembers = vi.fn(() => of(fixtures.members ?? page<GroupMember>([])));
  const removeMember = vi.fn(() => of(undefined));
  const updateMemberRole = vi.fn((_g: string, userId: string, payload: { role: string }) =>
    of(member(userId, payload.role as GroupMemberRole)),
  );
  const leaveGroup = vi.fn(() => of(undefined));

  const getGroupFeed = vi.fn(() => of(fixtures.posts ?? page<Post>([])));
  const toggleReaction = vi.fn(() => of({ reacted: true, count: 5 }));
  const deletePost = vi.fn(() => of({ deleted: true as const }));

  TestBed.configureTestingModule({
    providers: [
      GroupDetailStore,
      {
        provide: GroupService,
        useValue: { getById, getMembers, removeMember, updateMemberRole, leaveGroup },
      },
      { provide: PostService, useValue: { getGroupFeed, toggleReaction, deletePost } },
    ],
  });

  return {
    store: TestBed.inject(GroupDetailStore),
    getById,
    getMembers,
    getGroupFeed,
    toggleReaction,
    deletePost,
    removeMember,
    updateMemberRole,
  };
}

describe('GroupDetailStore — the viewer role', () => {
  // The whole reason the server returns `myRole`. Deriving it from the
  // member list is wrong: that list is paginated at 20 and ordered by join
  // date, so a moderator who joined late is simply not in the loaded rows
  // and reads as a non-member, silently losing their controls.
  it('takes the role from the group, not from the loaded members', () => {
    const { store } = setup({
      group: group({ myRole: GroupMemberRoles.Moderator }),
      // A page of members that does NOT contain the viewer.
      members: page([member('someone-else')]),
    });

    store.init(GROUP_ID);
    store.setTab(GroupTabs.Members);

    expect(store.viewerRole()).toBe(GroupMemberRoles.Moderator);
  });

  it('has no role until the group lands', () => {
    const { store, getById } = setup();
    getById.mockReturnValueOnce(throwError(() => new Error('offline')));

    store.init(GROUP_ID);

    expect(store.viewerRole()).toBeNull();
    expect(store.showGroupError()).toBe(true);
  });
});

describe('GroupDetailStore — what loads when', () => {
  it('loads the group and the posts tab on entry, but not the members', () => {
    const { store, getById, getGroupFeed, getMembers } = setup();

    store.init(GROUP_ID);

    expect(getById).toHaveBeenCalledTimes(1);
    expect(getGroupFeed).toHaveBeenCalledTimes(1);
    expect(getMembers).not.toHaveBeenCalled();
  });

  it('loads a tab the first time it is opened, and not again', () => {
    const { store, getMembers } = setup({ members: page([member('u-1')]) });
    store.init(GROUP_ID);

    store.setTab(GroupTabs.Members);
    store.setTab(GroupTabs.Posts);
    store.setTab(GroupTabs.Members);

    expect(getMembers).toHaveBeenCalledTimes(1);
  });

  it('fetches nothing extra for About', () => {
    const { store, getGroupFeed, getMembers } = setup();
    store.init(GROUP_ID);
    getGroupFeed.mockClear();

    store.setTab(GroupTabs.About);

    expect(getGroupFeed).not.toHaveBeenCalled();
    expect(getMembers).not.toHaveBeenCalled();
  });

  it('starts clean when the page is reused for a different group', () => {
    // Ionic reuses the page, so the previous group's rows must not survive
    // into the next one — and the tab goes back to Posts rather than
    // stranding the viewer on a Members list they did not open.
    const { store, getGroupFeed, getById } = setup({ posts: page([post('p1')]) });
    store.init(GROUP_ID);
    store.setTab(GroupTabs.Members);
    expect(store.posts()).toHaveLength(1);

    getGroupFeed.mockReturnValueOnce(of(page([post('p-other')])));
    getById.mockReturnValueOnce(of(group({ id: 'g-2', name: 'Strength Club' })));
    store.init('g-2');

    // Replaced, not appended: none of the first group's rows remain.
    expect(store.posts().map((p) => p.id)).toEqual(['p-other']);
    expect(store.group()?.name).toBe('Strength Club');
    expect(store.tab()).toBe(GroupTabs.Posts);
    expect(store.memberQuery()).toBe('');
  });

  it('does not leave the previous group\'s posts on screen when the next one fails to load', () => {
    // The case a successful switch hides: page 1 of the new group would
    // replace the array anyway, so only a failed load reveals whether the
    // rows were actually cleared. Showing another group's posts under this
    // group's name is the worst version of a stale list.
    const { store, getGroupFeed, getById } = setup({ posts: page([post('p1')]) });
    store.init(GROUP_ID);
    expect(store.posts()).toHaveLength(1);

    getById.mockReturnValueOnce(throwError(() => new Error('offline')));
    getGroupFeed.mockReturnValueOnce(throwError(() => new Error('offline')));
    store.init('g-2');

    expect(store.posts()).toEqual([]);
    expect(store.group()).toBeNull();
  });

  it('does not double-fetch when the page enters right after init', () => {
    // The param subscription inits, then `ionViewWillEnter` refreshes. A
    // forced refresh on top of the first load is two identical requests for
    // the same rows on every single open.
    const { store, getGroupFeed, getById } = setup();
    store.init(GROUP_ID);
    const afterInit = { feed: getGroupFeed.mock.calls.length, group: getById.mock.calls.length };

    store.reenter();

    expect(getGroupFeed).toHaveBeenCalledTimes(afterInit.feed);
    expect(getById).toHaveBeenCalledTimes(afterInit.group);
  });

  it('ignores a repeated init for the group already on screen', () => {
    const { store, getById } = setup();
    store.init(GROUP_ID);

    store.init(GROUP_ID);

    expect(getById).toHaveBeenCalledTimes(1);
  });
});

describe('GroupDetailStore — verbs', () => {
  it('takes the reaction count from the server rather than incrementing', () => {
    // Two devices on the same post would drift; the response is the truth.
    const { store } = setup({ posts: page([post('p1', { reactionCount: 1 })]) });
    store.init(GROUP_ID);

    store.toggleReaction(post('p1')).subscribe();

    expect(store.posts()[0].reactionCount).toBe(5);
    expect(store.posts()[0].myReaction).toBe('LIKE');
  });

  it('drops a deleted post and keeps the total honest', () => {
    const { store } = setup({ posts: page([post('p1'), post('p2')], 2) });
    store.init(GROUP_ID);

    store.deletePost('p1').subscribe();

    expect(store.posts().map((p) => p.id)).toEqual(['p2']);
    expect(store.postsHasMore()).toBe(false);
  });

  it('reloads rather than splicing in a new post', () => {
    // Under APPROVAL_REQUIRED the new post is not visible to anyone yet, so
    // showing it in the feed would misreport what just happened.
    const { store, getGroupFeed } = setup({ posts: page([post('p1')]) });
    store.init(GROUP_ID);
    getGroupFeed.mockClear();

    store.reloadPosts();

    expect(getGroupFeed).toHaveBeenCalledTimes(1);
  });

  it('drops a removed member and decrements the header count', () => {
    const { store } = setup({
      group: group({ memberCount: 4 }),
      members: page([member('u-1'), member('u-2')], 2),
    });
    store.init(GROUP_ID);
    store.setTab(GroupTabs.Members);

    store.removeMember('u-1').subscribe();

    expect(store.members().map((m) => m.userId)).toEqual(['u-2']);
    expect(store.membersTotal()).toBe(1);
    expect(store.group()?.memberCount).toBe(3);
  });

  it('reflects a promotion on the row it changed', () => {
    const { store } = setup({ members: page([member('u-1'), member('u-2')], 2) });
    store.init(GROUP_ID);
    store.setTab(GroupTabs.Members);

    store.updateMemberRole('u-1', 'MODERATOR').subscribe();

    const roles = store.members().map((m) => m.role);
    expect(roles).toEqual([GroupMemberRoles.Moderator, GroupMemberRoles.Member]);
  });
});

describe('GroupDetailStore — member search', () => {
  it('narrows loaded rows by name or email', () => {
    const { store } = setup({
      members: page([member('anna'), member('mihai')], 2),
    });
    store.init(GROUP_ID);
    store.setTab(GroupTabs.Members);

    store.setMemberQuery('mihai@');

    expect(store.visibleMembers().map((m) => m.userId)).toEqual(['mihai']);
    expect(store.isFilteredEmpty()).toBe(false);
  });

  it('separates "nobody matches" from "no members"', () => {
    const { store } = setup({ members: page([member('anna')], 1) });
    store.init(GROUP_ID);
    store.setTab(GroupTabs.Members);

    store.setMemberQuery('zzqq');

    expect(store.isFilteredEmpty()).toBe(true);
    expect(store.isEmpty()).toBe(false);
  });
});

describe('GroupDetailStore — failure', () => {
  it('keeps the rows it has and marks them stale when a refresh fails', () => {
    const { store, getGroupFeed } = setup({ posts: page([post('p1')]) });
    store.init(GROUP_ID);

    getGroupFeed.mockReturnValueOnce(throwError(() => new Error('offline')));
    store.refresh();

    expect(store.posts().map((p) => p.id)).toEqual(['p1']);
    expect(store.isStale()).toBe(true);
    expect(store.showLoadError()).toBe(false);
  });

  it('keeps earlier pages when a later one fails', () => {
    const { store, getGroupFeed } = setup({ posts: page([post('p1')], 2) });
    store.init(GROUP_ID);

    getGroupFeed.mockReturnValueOnce(throwError(() => new Error('offline')));
    store.loadMorePosts();

    expect(store.posts().map((p) => p.id)).toEqual(['p1']);
    expect(store.isStale()).toBe(false);
  });

  it('always calls done, so a refresher spinner cannot hang', () => {
    const { store, getGroupFeed } = setup();
    getGroupFeed.mockReturnValueOnce(throwError(() => new Error('offline')));
    const done = vi.fn();

    store.refresh(done);

    expect(done).toHaveBeenCalled();
  });

  it('calls done on the About tab, which fetches nothing', () => {
    const { store } = setup();
    store.init(GROUP_ID);
    store.setTab(GroupTabs.About);
    const done = vi.fn();

    store.refresh(done);

    expect(done).toHaveBeenCalled();
  });
});
