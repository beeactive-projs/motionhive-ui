import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  GroupService,
  JoinPolicies,
  JoinPolicy,
  PublicGroupProfile,
  SelfJoinResult,
} from 'core';

import { JoinActions } from '../groups.config';
import { GroupPreviewStore } from './group-preview.store';

const GROUP_ID = 'g-1';

function profile(joinPolicy: JoinPolicy = JoinPolicies.Open): PublicGroupProfile {
  return {
    group: { id: GROUP_ID, name: 'Strength Club', joinPolicy, memberCount: 2 },
    instructor: null,
    upcomingSessions: [],
  } as unknown as PublicGroupProfile;
}

function setup(options: { joinPolicy?: JoinPolicy; pending?: boolean } = {}) {
  const getPublicProfile = vi.fn(() => of(profile(options.joinPolicy)));
  const getMyJoinRequest = vi.fn(() =>
    of({ request: options.pending ? ({ id: 'r-1' } as never) : null }),
  );
  // Typed as the union: the server answers JOINED or PENDING depending on
  // the group's policy, and a test that mocks only one branch cannot express
  // the other.
  const selfJoin = vi.fn(
    (): ReturnType<GroupService['selfJoin']> =>
      of({ status: 'JOINED', message: 'ok', member: {} as never } as SelfJoinResult),
  );
  const cancelMyJoinRequest = vi.fn(() => of({ message: 'ok' }));

  TestBed.configureTestingModule({
    providers: [
      GroupPreviewStore,
      {
        provide: GroupService,
        useValue: { getPublicProfile, getMyJoinRequest, selfJoin, cancelMyJoinRequest },
      },
    ],
  });

  return {
    store: TestBed.inject(GroupPreviewStore),
    getPublicProfile,
    getMyJoinRequest,
    selfJoin,
    cancelMyJoinRequest,
  };
}

describe('GroupPreviewStore — the way in', () => {
  it('reads the public profile, not the members-only one', () => {
    // The whole reason this screen exists: `GET /groups/:id` 403s for a
    // non-member, which is exactly who is looking at this page.
    const { store, getPublicProfile } = setup();

    store.init(GROUP_ID);

    expect(getPublicProfile).toHaveBeenCalledWith(GROUP_ID);
  });

  it('offers an instant join on an open group', () => {
    const { store } = setup({ joinPolicy: JoinPolicies.Open });
    store.init(GROUP_ID);

    expect(store.cta()?.action).toBe(JoinActions.Join);
    expect(store.cta()?.enabled).toBe(true);
  });

  it('asks for approval on an approval group', () => {
    const { store } = setup({ joinPolicy: JoinPolicies.Approval });
    store.init(GROUP_ID);

    expect(store.cta()?.action).toBe(JoinActions.Request);
  });

  it('reports an existing request instead of offering to join again', () => {
    const { store } = setup({ joinPolicy: JoinPolicies.Approval, pending: true });
    store.init(GROUP_ID);

    expect(store.cta()?.action).toBe(JoinActions.Pending);
    expect(store.cta()?.enabled).toBe(false);
  });

  it('flips to pending when the server says the join is awaiting approval', () => {
    // The policy does not decide this — the server does. An OPEN group
    // returns JOINED, an APPROVAL one returns PENDING.
    const { store, selfJoin } = setup({ joinPolicy: JoinPolicies.Approval });
    store.init(GROUP_ID);
    selfJoin.mockReturnValueOnce(
      of({ status: 'PENDING', message: 'ok', request: {} as never } as SelfJoinResult),
    );

    store.join().subscribe();

    expect(store.cta()?.action).toBe(JoinActions.Pending);
  });

  it('does not flip to pending when the join went straight through', () => {
    const { store } = setup({ joinPolicy: JoinPolicies.Open });
    store.init(GROUP_ID);

    store.join().subscribe();

    expect(store.cta()?.action).toBe(JoinActions.Join);
  });

  it('restores the join control after a request is withdrawn', () => {
    const { store } = setup({ joinPolicy: JoinPolicies.Approval, pending: true });
    store.init(GROUP_ID);
    expect(store.cta()?.action).toBe(JoinActions.Pending);

    store.cancelRequest().subscribe();

    expect(store.cta()?.action).toBe(JoinActions.Request);
  });
});

describe('GroupPreviewStore — failure', () => {
  it('survives the pending-request check failing', () => {
    // "Do I have a request?" answering 404 is an answer, not an error — and
    // it must not take the group's own profile down with it.
    const { store, getMyJoinRequest } = setup();
    getMyJoinRequest.mockReturnValueOnce(throwError(() => ({ status: 404 })));

    store.init(GROUP_ID);

    expect(store.profile()).not.toBeNull();
    expect(store.cta()?.action).toBe(JoinActions.Join);
  });

  it('treats a private or missing group as nothing to see', () => {
    const { store, getPublicProfile } = setup();
    getPublicProfile.mockReturnValueOnce(throwError(() => ({ status: 403 })));

    store.init(GROUP_ID);

    expect(store.notFound()).toBe(true);
    expect(store.showError()).toBe(false);
  });

  it('separates a dead connection from a private group', () => {
    const { store, getPublicProfile } = setup();
    getPublicProfile.mockReturnValueOnce(throwError(() => ({ status: 500 })));

    store.init(GROUP_ID);

    expect(store.showError()).toBe(true);
    expect(store.notFound()).toBe(false);
  });
});
