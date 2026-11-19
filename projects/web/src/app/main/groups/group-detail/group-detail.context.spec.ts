import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AuthStore, GroupService, GroupsRefreshService, GroupWithMyRole } from 'core';

import { GroupDetailContext, MEMBERS_PAGE_SIZE } from './group-detail.context';

function member(userId: string) {
  return { id: `m-${userId}`, userId, role: 'MEMBER' };
}

function setup(myRole: string, total = 0) {
  const group = { id: 'g-1', instructorId: 'owner', myRole } as unknown as GroupWithMyRole;
  const groupService = {
    getById: vi.fn(() => of(group)),
    getMembers: vi.fn((_id: string, page: number) =>
      of({ items: [member(`u${page}a`), member(`u${page}b`)], total }),
    ),
  };
  const add = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      GroupDetailContext,
      { provide: GroupService, useValue: groupService },
      { provide: MessageService, useValue: { add } },
      { provide: ConfirmationService, useValue: { confirm: vi.fn() } },
      { provide: AuthStore, useValue: { user: signal({ id: 'me' }) } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: GroupsRefreshService, useValue: { notify: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const context = TestBed.inject(GroupDetailContext);
  context.loadGroup('g-1');
  return { context, groupService, add };
}

describe('GroupDetailContext, the viewer', () => {
  // The member list is paged: a moderator past the first page used to read
  // as a non-member and lose moderation and the Leave button.
  it('takes the role from the group, not from the members loaded so far', () => {
    const { context } = setup('MODERATOR');
    expect(context.members()).toEqual([]);
    expect(context.canModerate()).toBe(true);
    expect(context.canLeave()).toBe(true);
  });

  it('gives a member no moderation but still a way out', () => {
    const { context } = setup('MEMBER');
    expect(context.canModerate()).toBe(false);
    expect(context.canLeave()).toBe(true);
  });
});

describe('GroupDetailContext, members pages', () => {
  it('reads the next page after the first and stops at the total', () => {
    const { context, groupService } = setup('OWNER', 4);
    context.loadMembers('g-1');
    expect(groupService.getMembers).toHaveBeenLastCalledWith('g-1', 1, MEMBERS_PAGE_SIZE);
    expect(context.hasMoreMembers()).toBe(true);

    context.loadMoreMembers();

    expect(groupService.getMembers).toHaveBeenLastCalledWith('g-1', 2, MEMBERS_PAGE_SIZE);
    expect(context.members().map((m) => m.userId)).toEqual(['u1a', 'u1b', 'u2a', 'u2b']);
    expect(context.hasMoreMembers()).toBe(false);
  });

  it('asks for the same page again after a failed Show more', () => {
    const { context, groupService, add } = setup('OWNER', 4);
    context.loadMembers('g-1');
    groupService.getMembers.mockReturnValueOnce(throwError(() => new Error('offline')));

    context.loadMoreMembers();
    expect(add).toHaveBeenCalled();
    context.loadMoreMembers();

    expect(groupService.getMembers).toHaveBeenLastCalledWith('g-1', 2, MEMBERS_PAGE_SIZE);
  });
});
