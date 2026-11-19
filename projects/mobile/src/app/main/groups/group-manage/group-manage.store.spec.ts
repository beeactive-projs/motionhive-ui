import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { GroupJoinRequest, GroupService, Post, PostService } from 'core';

import { GroupManageStore } from './group-manage.store';

function request(id: string): GroupJoinRequest {
  return { id, groupId: 'g1', userId: `u-${id}`, message: null, createdAt: '' } as GroupJoinRequest;
}

function post(id: string): Post {
  return { id, groupId: 'g1', content: 'hello' } as Post;
}

function page<T>(items: T[], total: number) {
  return { items, total, page: 1, pageSize: 20 };
}

function setup(requestPages: ReturnType<typeof page<GroupJoinRequest>>[], postTotal = 0) {
  const groupService = {
    listJoinRequests: vi.fn(),
    decideJoinRequest: vi.fn(() => of({})),
  };
  for (const p of requestPages) {
    groupService.listJoinRequests.mockReturnValueOnce(of(p));
  }
  const postService = {
    getPendingForGroup: vi.fn(() => of(page([post('p1')], postTotal))),
    moderatePost: vi.fn(() => of({})),
  };
  TestBed.configureTestingModule({
    providers: [
      GroupManageStore,
      { provide: GroupService, useValue: groupService },
      { provide: PostService, useValue: postService },
    ],
  });
  const store = TestBed.inject(GroupManageStore);
  store.init('g1');
  return { store, groupService, postService };
}

describe('GroupManageStore, queue counts', () => {
  // Each queue reads a page of 20: 35 requests used to badge as 20.
  it('counts what waits on the server, not what is on screen', () => {
    const { store } = setup([page([request('r1'), request('r2')], 35)], 12);
    expect(store.requestCount()).toBe(35);
    expect(store.postCount()).toBe(12);
  });

  it('counts a decision down at once', () => {
    const { store } = setup([page([request('r1'), request('r2')], 35)]);
    store.decideRequest(request('r1'), 'APPROVE').subscribe();
    expect(store.requestCount()).toBe(34);
    expect(store.requests().map((r) => r.id)).toEqual(['r2']);
  });

  // Deciding the page on screen used to read "nothing waiting" while more
  // still waited on the server.
  it('reads the next requests in once the page on screen is decided', () => {
    const { store, groupService } = setup([
      page([request('r1')], 2),
      page([request('r2')], 1),
    ]);
    store.decideRequest(request('r1'), 'REJECT').subscribe();

    expect(groupService.listJoinRequests).toHaveBeenCalledTimes(2);
    expect(store.requests().map((r) => r.id)).toEqual(['r2']);
    expect(store.requestCount()).toBe(1);
  });

  it('stops at the real end of the queue', () => {
    const { store, groupService } = setup([page([request('r1')], 1)]);
    store.decideRequest(request('r1'), 'APPROVE').subscribe();
    expect(groupService.listJoinRequests).toHaveBeenCalledTimes(1);
    expect(store.requestCount()).toBe(0);
    expect(store.requestsRefilling()).toBe(false);
  });

  it('reads the next posts in the same way', () => {
    const { store, postService } = setup([page([], 0)], 2);
    store.moderatePost(post('p1'), 'APPROVED').subscribe();
    expect(postService.getPendingForGroup).toHaveBeenCalledTimes(2);
    expect(store.postCount()).toBe(2);
  });

  it('keeps the count of a queue that refused to load at nothing', () => {
    const groupService = {
      listJoinRequests: vi.fn(() => throwError(() => ({ status: 403 }))),
      decideJoinRequest: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        GroupManageStore,
        { provide: GroupService, useValue: groupService },
        {
          provide: PostService,
          useValue: { getPendingForGroup: vi.fn(() => of(page([], 0))), moderatePost: vi.fn() },
        },
      ],
    });
    const store = TestBed.inject(GroupManageStore);
    store.init('g1');
    expect(store.requestCount()).toBe(0);
    expect(store.requestsAllowed()).toBe(false);
  });
});
