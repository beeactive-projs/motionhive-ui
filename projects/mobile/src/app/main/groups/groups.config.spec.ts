/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import {
  DiscoverGroup,
  Group,
  GroupMember,
  GroupMemberPostPolicies,
  GroupMemberRoles,
  JoinPolicies,
} from 'core';

import {
  JoinActions,
  canDeleteComment,
  canDeletePost,
  canEditPost,
  canLeave,
  canManageGroup,
  canManageJoinLink,
  canModeratePosts,
  canPost,
  canSeeMemberEmails,
  isPostingBlockedError,
  joinCta,
  joinPolicyLabel,
  memberRoleLabel,
  postNeedsApproval,
} from './groups.config';
import {
  MIN_SEARCH_LENGTH,
  matchesGroupQuery,
  matchesMemberQuery,
} from './groups.filters';

const OWNER = GroupMemberRoles.Owner;
const MODERATOR = GroupMemberRoles.Moderator;
const MEMBER = GroupMemberRoles.Member;
/** Not a member of the group at all. */
const OUTSIDER = null;

const ROLES = [OWNER, MODERATOR, MEMBER, OUTSIDER] as const;

function group(overrides: Partial<Group> = {}): Group {
  return {
    memberPostPolicy: GroupMemberPostPolicies.Open,
    ...overrides,
  } as Group;
}

describe('groups.config — the role matrix', () => {
  // The asymmetry this whole file exists to protect: a moderator moderates
  // posts and has no power over members. On the API every group mutation
  // gates on assertOwner; MODERATOR carries privileges only in the post
  // service.
  it('lets owner and moderator moderate posts, and nobody else', () => {
    expect(ROLES.filter(canModeratePosts)).toEqual([OWNER, MODERATOR]);
  });

  it('restricts every member-management power to the owner alone', () => {
    expect(ROLES.filter(canManageGroup)).toEqual([OWNER]);
    expect(ROLES.filter(canSeeMemberEmails)).toEqual([OWNER]);
  });

  it('does not let a moderator manage the group', () => {
    // Stated separately because this is the exact mistake to guard against.
    expect(canManageGroup(MODERATOR)).toBe(false);
    expect(canSeeMemberEmails(MODERATOR)).toBe(false);
  });

  it('lets members and moderators leave, but never the owner', () => {
    expect(ROLES.filter(canLeave)).toEqual([MODERATOR, MEMBER]);
  });

  it('needs the platform instructor role for a join link, not just ownership', () => {
    // Both join-link routes carry @Roles('INSTRUCTOR', …), checked before
    // the service. An owner-by-transfer without it gets 403.
    expect(canManageJoinLink(OWNER, true)).toBe(true);
    expect(canManageJoinLink(OWNER, false)).toBe(false);
    expect(canManageJoinLink(MODERATOR, true)).toBe(false);
  });
});

describe('groups.config — posting', () => {
  it('lets staff post whatever the group policy says', () => {
    const disabled = group({ memberPostPolicy: GroupMemberPostPolicies.Disabled });
    expect(canPost(OWNER, disabled)).toBe(true);
    expect(canPost(MODERATOR, disabled)).toBe(true);
  });

  it('blocks a plain member when posting is disabled', () => {
    expect(canPost(MEMBER, group({ memberPostPolicy: GroupMemberPostPolicies.Disabled }))).toBe(
      false,
    );
  });

  it('lets a plain member post when the policy allows or reviews', () => {
    expect(canPost(MEMBER, group({ memberPostPolicy: GroupMemberPostPolicies.Open }))).toBe(true);
    expect(
      canPost(MEMBER, group({ memberPostPolicy: GroupMemberPostPolicies.ApprovalRequired })),
    ).toBe(true);
  });

  it('never lets a non-member post', () => {
    expect(canPost(OUTSIDER, group())).toBe(false);
  });

  it('warns a member their post will wait, but never staff', () => {
    const reviewed = group({ memberPostPolicy: GroupMemberPostPolicies.ApprovalRequired });
    expect(postNeedsApproval(MEMBER, reviewed)).toBe(true);
    expect(postNeedsApproval(OWNER, reviewed)).toBe(false);
    expect(postNeedsApproval(MODERATOR, reviewed)).toBe(false);
    expect(postNeedsApproval(MEMBER, group())).toBe(false);
  });
});

describe('groups.config — post and comment authorship', () => {
  it('lets only the author edit, even a moderator', () => {
    expect(canEditPost('me', 'me')).toBe(true);
    expect(canEditPost('me', 'someone-else')).toBe(false);
  });

  it('lets the author or staff delete a post', () => {
    expect(canDeletePost(MEMBER, 'me', 'me')).toBe(true);
    expect(canDeletePost(MODERATOR, 'me', 'someone-else')).toBe(true);
    expect(canDeletePost(MEMBER, 'me', 'someone-else')).toBe(false);
  });

  it('lets the author or staff delete a comment', () => {
    // Web offers this to the author alone; the API allows staff, and this
    // follows the API.
    expect(canDeleteComment(OWNER, 'me', 'someone-else')).toBe(true);
    expect(canDeleteComment(MEMBER, 'me', 'someone-else')).toBe(false);
  });
});

describe('groups.config — the join control', () => {
  it('offers an instant join on an open group', () => {
    expect(joinCta(JoinPolicies.Open, false)).toEqual({
      action: JoinActions.Join,
      label: 'Join group',
      enabled: true,
    });
  });

  it('asks for approval on an approval group', () => {
    expect(joinCta(JoinPolicies.Approval, false).action).toBe(JoinActions.Request);
  });

  it('reports a pending request whatever the policy, and disables the control', () => {
    for (const policy of [JoinPolicies.Open, JoinPolicies.Approval, JoinPolicies.InviteOnly]) {
      const cta = joinCta(policy, true);
      expect(cta.action).toBe(JoinActions.Pending);
      expect(cta.enabled).toBe(false);
    }
  });

  it('closes an invite-only group', () => {
    expect(joinCta(JoinPolicies.InviteOnly, false).enabled).toBe(false);
  });

  it('uses one label per policy', () => {
    // Web says "Approval" on a card and "Approval required" in the hero
    // above it. One string, used everywhere.
    expect(joinPolicyLabel(JoinPolicies.Approval)).toBe('Approval required');
    expect(joinPolicyLabel(JoinPolicies.Open)).toBe('Open');
    expect(joinPolicyLabel(JoinPolicies.InviteOnly)).toBe('Invite only');
  });

  it('labels every member role', () => {
    expect(memberRoleLabel(OWNER)).toBe('Owner');
    expect(memberRoleLabel(MODERATOR)).toBe('Moderator');
    expect(memberRoleLabel(MEMBER)).toBe('Member');
  });
});

describe('groups.config — error matching', () => {
  it('recognises the two posting errors that carry a raw group id', () => {
    // These interpolate ${group.id}, so equality never matches.
    expect(
      isPostingBlockedError('Members are not allowed to post in group 7d9c9382-23ca-4cad'),
    ).toBe(true);
    expect(
      isPostingBlockedError('You are not an active member of group 7d9c9382-23ca-4cad'),
    ).toBe(true);
  });

  it('leaves unrelated messages alone', () => {
    expect(isPostingBlockedError('You are not a member of this group')).toBe(false);
    expect(isPostingBlockedError('')).toBe(false);
  });
});

describe('groups.filters — search', () => {
  function discover(overrides: Partial<DiscoverGroup> = {}): DiscoverGroup {
    return {
      name: 'Morning Crew',
      description: 'Small in-person strength crew',
      tags: ['strength', 'demo'],
      ...overrides,
    } as DiscoverGroup;
  }

  it('matches a group on name, description or tag', () => {
    expect(matchesGroupQuery(discover(), 'morning')).toBe(true);
    expect(matchesGroupQuery(discover(), 'strength')).toBe(true);
    expect(matchesGroupQuery(discover(), 'demo')).toBe(true);
    expect(matchesGroupQuery(discover(), 'yoga')).toBe(false);
  });

  it('treats an empty term as matching everything', () => {
    expect(matchesGroupQuery(discover(), '   ')).toBe(true);
  });

  it('survives a group with no description or tags', () => {
    expect(matchesGroupQuery(discover({ description: null, tags: null }), 'morning')).toBe(true);
    expect(matchesGroupQuery(discover({ description: null, tags: null }), 'strength')).toBe(false);
  });

  it('matches a member on name or email', () => {
    const member = {
      user: { firstName: 'Anna', lastName: 'Popescu', email: 'anna@motionhive.fit' },
    } as GroupMember;
    expect(matchesMemberQuery(member, 'popescu')).toBe(true);
    expect(matchesMemberQuery(member, 'anna@')).toBe(true);
    expect(matchesMemberQuery(member, 'mihai')).toBe(false);
  });

  it('survives a member whose user snapshot is missing', () => {
    // A soft-deleted user comes back without the association.
    expect(matchesMemberQuery({} as GroupMember, 'anna')).toBe(false);
    expect(matchesMemberQuery({} as GroupMember, '')).toBe(true);
  });

  it('has a search floor', () => {
    expect(MIN_SEARCH_LENGTH).toBeGreaterThan(1);
  });
});
