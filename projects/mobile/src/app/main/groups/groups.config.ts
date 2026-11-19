import {
  Group,
  GroupMember,
  WEB_APP_URL,
  GroupMemberPostPolicies,
  GroupMemberPostPolicy,
  GroupMemberRole,
  GroupMemberRoles,
  JoinPolicies,
  JoinPolicy,
  GroupWithMyRole,
  enumLabel,
  formatRelativeShort,
  translate,
} from 'core';

import { SheetAction } from '../../_shared/components/action-sheet/action-sheet.model';
import { ProfileStacks, groupLinks, stackRootOf } from '../../_shared/utils/stack-paths';

/**
 * Every decision the Groups screens branch on, as pure functions.
 *
 * The API enforces all of this and will reject a forbidden call, but a
 * screen that offers an action it knows will 403 is a worse screen. These
 * answer "may this person see this control", and being pure is the point:
 * the role matrix is the part of Groups most likely to be got wrong, and
 * here it is covered by tests rather than by tapping.
 */

/** Who the viewer is in a group. `null` = not a member. */
export type ViewerRole = GroupMemberRole | null;

// ── Roles ────────────────────────────────────────────────────────────────

/**
 * The asymmetry that defines this feature: a moderator moderates *posts* and
 * has no power over *members*.
 *
 * On the API every group mutation gates on `assertOwner`, and `MODERATOR`
 * carries privileges in exactly one place — `assertGroupStaff` in the post
 * service. So a moderator approves posts and deletes anyone's post, but
 * cannot approve a join request, change a role, remove anyone, or see an
 * email. Treating "staff" as one thing is the bug this file exists to
 * prevent.
 */
export function isStaff(role: ViewerRole): boolean {
  return role === GroupMemberRoles.Owner || role === GroupMemberRoles.Moderator;
}

export function isOwner(role: ViewerRole): boolean {
  return role === GroupMemberRoles.Owner;
}

export function isMember(role: ViewerRole): boolean {
  return role !== null;
}

/** Moderate the pending queue, and delete anyone's post or comment. */
export const canModeratePosts = isStaff;

/** Members, roles, join requests, invites, the group itself. Owner only. */
export const canManageGroup = isOwner;

/**
 * Emails belong to the owner alone — and only on the manage screen. The
 * group's own member tab deliberately shows none: it is a social list, and
 * an address under every name made it read like an export.
 */
export const canSeeMemberEmails = isOwner;

/**
 * The owner cannot leave — the API answers "Group owner cannot leave.
 * Transfer ownership first or delete the group." Offering the row and
 * failing is worse than not offering it.
 */
export function canLeave(role: ViewerRole): boolean {
  return isMember(role) && !isOwner(role);
}

/**
 * Generating or revoking a join link needs the *platform* INSTRUCTOR role,
 * not group ownership: both routes carry `@Roles('INSTRUCTOR', …)`, checked
 * before the service runs. A non-instructor who received ownership by
 * transfer owns the group and still cannot mint a link, so the control is
 * hidden rather than left to 403.
 */
export function canManageJoinLink(role: ViewerRole, isInstructor: boolean): boolean {
  return isOwner(role) && isInstructor;
}

/**
 * May the viewer post? Staff always may, whatever the policy — the API
 * approves their posts outright. A plain member is governed by the group's
 * `memberPostPolicy`, and under `APPROVAL_REQUIRED` may post but lands in
 * the pending queue.
 */
export function canPost(role: ViewerRole, group: Pick<Group, 'memberPostPolicy'>): boolean {
  if (!isMember(role)) return false;
  if (isStaff(role)) return true;
  return group.memberPostPolicy !== GroupMemberPostPolicies.Disabled;
}

/**
 * True when this viewer's post will wait for review rather than appear.
 * Read to say so on the composer, because the API returns success either
 * way and only `approvalState` on the response tells them apart.
 */
export function postNeedsApproval(
  role: ViewerRole,
  group: Pick<Group, 'memberPostPolicy'>,
): boolean {
  if (isStaff(role)) return false;
  return group.memberPostPolicy === GroupMemberPostPolicies.ApprovalRequired;
}

/** Edit is the author's alone — staff may delete, never rewrite. */
export function canEditPost(viewerId: string, authorId: string): boolean {
  return viewerId === authorId;
}

export function canDeletePost(role: ViewerRole, viewerId: string, authorId: string): boolean {
  return viewerId === authorId || canModeratePosts(role);
}

/** Same rule for comments: the author, or staff moderating the group. */
export function canDeleteComment(role: ViewerRole, viewerId: string, authorId: string): boolean {
  return viewerId === authorId || canModeratePosts(role);
}

// ── Join policy ──────────────────────────────────────────────────────────

/** What the join control does on a group the viewer is not in. */
export const JoinActions = {
  Join: 'join',
  Request: 'request',
  Pending: 'pending',
  Closed: 'closed',
} as const;

export type JoinAction = (typeof JoinActions)[keyof typeof JoinActions];

export interface JoinCta {
  action: JoinAction;
  label: string;
  /** False for the two states that are reports, not buttons. */
  enabled: boolean;
}

/**
 * The single source for the join button, used by the Discover card, the
 * preview screen and the hub alike — three places web words differently.
 *
 * `INVITE_ONLY` never reaches Discover, which the API filters out, but the
 * preview can be deep-linked so the closed state still has to exist.
 */
export function joinCta(policy: JoinPolicy, hasPendingRequest: boolean): JoinCta {
  if (hasPendingRequest) {
    return { action: JoinActions.Pending, label: translate('groups.join.pending'), enabled: false };
  }
  switch (policy) {
    case JoinPolicies.Open:
      return { action: JoinActions.Join, label: translate('button.joinGroup'), enabled: true };
    case JoinPolicies.Approval:
      return {
        action: JoinActions.Request,
        label: translate('button.requestToJoin'),
        enabled: true,
      };
    case JoinPolicies.InviteOnly:
      return { action: JoinActions.Closed, label: translate('groups.join.closed'), enabled: false };
  }
}

/**
 * One label per policy, everywhere.
 *
 * Web says "Approval" on a card and "Approval required" in the hero above
 * it, on the same screen. Core's `joinPolicyLabel` exists but its companion
 * `joinPolicySeverity` returns a PrimeNG severity, which this project bans,
 * so the pair lives here instead of half-importing one of them.
 */
export function joinPolicyLabel(policy: JoinPolicy): string {
  return translate(`groups.joinPolicy.${policy}`);
}

/**
 * The tone of the policy badge (`data-tone`, ion-badge.css): a wash, which
 * clears AA where a coloured chip did not. `medium` names no tone of its
 * own, so it takes the badge's neutral default.
 */
export function joinPolicyTone(policy: JoinPolicy): string {
  switch (policy) {
    case JoinPolicies.Open:
      return 'success';
    case JoinPolicies.Approval:
      // Not amber: it sits too close to honey, and honey never marks a status.
      return 'info';
    case JoinPolicies.InviteOnly:
      return 'medium';
  }
}

/** The tone of the role badge on a member row (`data-tone`, ion-badge.css). */
export function memberRoleTone(role: GroupMemberRole): string {
  switch (role) {
    case GroupMemberRoles.Owner:
      return 'honey';
    case GroupMemberRoles.Moderator:
      return 'info';
    case GroupMemberRoles.Member:
      return 'medium';
  }
}

export function memberRoleLabel(role: GroupMemberRole): string {
  return enumLabel('groupMemberRole', role);
}

/**
 * The label beside a group preview's back arrow: the screen back returns to.
 *
 * Discover opens a preview from two screens with one URL (its strip and its
 * "All groups" list both push `/tabs/discover/group/:id`), so the URL alone
 * cannot say which; the page that was open before can. It counts only when
 * it is in the same stack, since back never crosses a tab. Without it (a
 * cold load, or an arrival from another tab) back goes to the stack's root,
 * and the label names that.
 */
export function previewBackLabel(url: string, previousUrl: string | null): string {
  const path = (value: string) => value.split(/[?#]/)[0];
  const root = stackRootOf(url);
  if (previousUrl && root && stackRootOf(previousUrl) === root) {
    const from = path(previousUrl);
    if (from === ProfileStacks.Groups || from === `${ProfileStacks.Discover}/groups`) {
      return 'nav.groups';
    }
    if (from === ProfileStacks.Discover) return 'nav.discover';
    return 'button.back';
  }
  if (root === ProfileStacks.Discover) return 'nav.discover';
  return groupLinks(url).inGroupsTab ? 'nav.groups' : 'button.back';
}

// ── Form options ─────────────────────────────────────────────────────────

/**
 * What each join policy means, in the order a new group should consider
 * them. The description matters more than the label here: "Approval" alone
 * tells an owner nothing about who ends up reviewing what.
 *
 * `label` and `hint` are translation keys — the form's template translates.
 */
export const JOIN_POLICY_OPTIONS: ReadonlyArray<{
  value: JoinPolicy;
  label: string;
  hint: string;
}> = [
  {
    value: JoinPolicies.Open,
    label: 'groups.joinPolicy.OPEN',
    hint: 'groups.joinPolicyHint.OPEN',
  },
  {
    value: JoinPolicies.Approval,
    label: 'groups.joinPolicy.APPROVAL',
    hint: 'groups.joinPolicyHint.APPROVAL',
  },
  {
    value: JoinPolicies.InviteOnly,
    label: 'groups.joinPolicy.INVITE_ONLY',
    hint: 'groups.joinPolicyHint.INVITE_ONLY',
  },
];

/** Who may post, and whether it waits for review. Keys, like the above. */
export const POST_POLICY_OPTIONS: ReadonlyArray<{
  value: GroupMemberPostPolicy;
  label: string;
  hint: string;
}> = [
  {
    value: GroupMemberPostPolicies.Open,
    label: 'groups.postPolicy.OPEN',
    hint: 'groups.postPolicyHint.OPEN',
  },
  {
    value: GroupMemberPostPolicies.ApprovalRequired,
    label: 'groups.postPolicy.APPROVAL_REQUIRED',
    hint: 'groups.postPolicyHint.APPROVAL_REQUIRED',
  },
  {
    value: GroupMemberPostPolicies.Disabled,
    label: 'groups.postPolicy.DISABLED',
    hint: 'groups.postPolicyHint.DISABLED',
  },
];

/** `CreateGroupDto`: name `@MaxLength(255)`. */
export const GROUP_NAME_MAX_LENGTH = 255;
/** Long enough for a real description; the column is unbounded text. */
export const GROUP_DESCRIPTION_MAX_LENGTH = 2000;
/** Beyond this a tag row stops being scannable. */
export const GROUP_MAX_TAGS = 10;
export const GROUP_TAG_MAX_LENGTH = 30;

// ── Composition limits, mirrored from the API's validators ───────────────

/** `CreatePostDto`: content `@MaxLength(5000)`. */
export const POST_MAX_LENGTH = 5000;
/** `CreateCommentDto`: content `@MaxLength(2000)`. */
export const COMMENT_MAX_LENGTH = 2000;
/** `mediaUrls` `@ArrayMaxSize(4)`, and one upload call per image. */
export const POST_MAX_IMAGES = 4;
/** Rejected by the upload route with 'File is larger than 5 MB.' */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// ── Invite links ─────────────────────────────────────────────────────────

/**
 * Where a group's join link lands.
 *
 * Built on the web app's address, never `window.location` — inside the
 * WebView that is `capacitor://localhost`, which is meaningless to whoever
 * receives the link. Same reasoning as the client invite's `SIGNUP_URL`.
 *
 * The path is `/join/<token>`, which is where web's `mainRoutes` mounts its
 * accept screen — the same address web's own copy button builds.
 */
export function joinLinkUrl(token: string): string {
  return `${WEB_APP_URL}/join/${token}`;
}

// ── Errors ───────────────────────────────────────────────────────────────

/**
 * Two API messages interpolate a raw group id, so they cannot be matched by
 * equality. Both mean the same thing to a reader: you cannot post here.
 */
const POSTING_DISABLED_PREFIX = 'Members are not allowed to post in group ';
const NOT_A_MEMBER_PREFIX = 'You are not an active member of group ';

export function isPostingBlockedError(message: string): boolean {
  return (
    message.startsWith(POSTING_DISABLED_PREFIX) || message.startsWith(NOT_A_MEMBER_PREFIX)
  );
}

// ── Groups home ──────────────────────────────────────────────────────────

/** Join requests plus posts waiting on you in one group: its red count. */
export function waitingCount(
  group: Pick<GroupWithMyRole, 'pendingJoinRequestCount' | 'pendingPostCount'>,
): number {
  return (group.pendingJoinRequestCount ?? 0) + (group.pendingPostCount ?? 0);
}

/**
 * The line under a group waiting on you: "2 join requests · 1 post to
 * review", each part only when there is some.
 */
export function waitingLine(
  group: Pick<GroupWithMyRole, 'pendingJoinRequestCount' | 'pendingPostCount'>,
): string {
  const parts: string[] = [];
  const requests = group.pendingJoinRequestCount ?? 0;
  const posts = group.pendingPostCount ?? 0;
  if (requests > 0) {
    parts.push(translate('groups.list.waiting.requests', { count: requests }));
  }
  if (posts > 0) {
    parts.push(translate('groups.list.waiting.posts', { count: posts }));
  }
  return parts.join(' · ');
}

/**
 * The line under a group in Your groups. One you run says how alive it is
 * ("4 members · last post 2h"); one you joined says whose it is ("Run by
 * Ioana Pop · 12 members").
 */
export function groupRowLine(group: GroupWithMyRole, ownerName: string): string {
  const members = translate('count.members', { count: group.memberCount });
  if (isOwner(group.myRole)) {
    if (group.lastPostAt) {
      const time = formatRelativeShort(group.lastPostAt);
      return `${members} · ${translate('groups.list.lastPost', { time })}`;
    }
    return `${members} · ${translate('groups.list.noPosts')}`;
  }
  if (ownerName) {
    return `${translate('groups.list.runBy', { name: ownerName })} · ${members}`;
  }
  return members;
}

/**
 * Where a "Needs you" row goes: Manage on the queue with something in it,
 * join requests first. Moderators only ever have posts.
 */
export function manageTabFor(
  group: Pick<GroupWithMyRole, 'pendingJoinRequestCount'>,
): 'requests' | 'posts' {
  if ((group.pendingJoinRequestCount ?? 0) > 0) {
    return 'requests';
  }
  return 'posts';
}

// ── The group page's ⋯ ───────────────────────────────────────────────────

/** The verbs a group's ⋯ can offer. */
export const GroupActionIds = {
  Edit: 'edit',
  Invite: 'invite',
  Requests: 'requests',
  ReviewPosts: 'review-posts',
  Delete: 'delete',
  Leave: 'leave',
} as const;

export type GroupActionId = (typeof GroupActionIds)[keyof typeof GroupActionIds];

/**
 * A group's verbs for the reader, in the sheet's order (design 2026-11-14).
 * The owner gets Edit, Invite people, Join requests and Review posts, with
 * Delete group in the red card; a moderator only Review posts; a member only
 * Leave group, in red. The queues carry their counts. Handing the group over
 * comes later.
 */
export function groupActions(
  role: ViewerRole,
  group: Pick<GroupWithMyRole, 'pendingJoinRequestCount' | 'pendingPostCount'>,
): SheetAction<GroupActionId>[] {
  const actions: SheetAction<GroupActionId>[] = [];
  if (isOwner(role)) {
    actions.push(
      { id: GroupActionIds.Edit, label: 'groups.actions.edit', icon: 'create-outline', color: 'primary' },
      {
        id: GroupActionIds.Invite,
        label: 'groups.actions.invite',
        icon: 'person-add-outline',
        color: 'info',
        tone: 'shade',
      },
      {
        id: GroupActionIds.Requests,
        label: 'groups.actions.requests',
        icon: 'people-outline',
        color: 'violet',
        value: countValue(group.pendingJoinRequestCount),
      },
    );
  }
  if (isStaff(role)) {
    actions.push({
      id: GroupActionIds.ReviewPosts,
      label: 'groups.actions.reviewPosts',
      icon: 'shield-checkmark-outline',
      color: 'info',
      tone: 'shade',
      value: countValue(group.pendingPostCount),
    });
  }
  if (isOwner(role)) {
    actions.push({
      id: GroupActionIds.Delete,
      label: 'groups.edit.delete.button',
      icon: 'trash-outline',
      color: 'danger',
      destructive: true,
    });
  } else if (canLeave(role)) {
    // A moderator may leave too: the design's "Review posts only" is about
    // the verbs over the group, and nobody should be stuck in one.
    actions.push({
      id: GroupActionIds.Leave,
      label: 'groups.detail.leave.button',
      icon: 'exit-outline',
      color: 'danger',
      destructive: true,
    });
  }
  return actions;
}

/** A queue's count at the end of its row, or nothing when it is empty. */
function countValue(count: number | undefined): string | undefined {
  if (!count) {
    return undefined;
  }
  return String(count);
}

/** The line under the sheet's title: how the reader stands in the group. */
export function groupRoleLine(role: ViewerRole): string {
  if (isOwner(role)) {
    return translate('groups.actions.youRun');
  }
  if (role === GroupMemberRoles.Moderator) {
    return translate('groups.actions.youModerate');
  }
  return translate('groups.actions.youAreIn');
}

// ── A member's ⋯ (Members tab) ──────────────────────────────────────────

export const MemberActionIds = {
  Profile: 'profile',
  Message: 'message',
  MakeModerator: 'make-moderator',
  RemoveModerator: 'remove-moderator',
  Remove: 'remove',
} as const;

export type MemberActionId = (typeof MemberActionIds)[keyof typeof MemberActionIds];

/**
 * The verbs on one member. Anyone may open a profile (when the account has a
 * handle) or message them; the owner also sets who moderates and removes
 * people. Nobody acts on the owner's row, and nobody messages themselves.
 */
export function memberActions(
  viewerRole: ViewerRole,
  member: Pick<GroupMember, 'userId' | 'role' | 'user'>,
  viewerId: string,
): SheetAction<MemberActionId>[] {
  const actions: SheetAction<MemberActionId>[] = [];
  const handle = member.user?.handle;
  if (handle) {
    actions.push({
      id: MemberActionIds.Profile,
      label: 'button.viewProfile',
      icon: 'person-outline',
      color: 'violet',
    });
  }
  const isSelf = member.userId === viewerId;
  if (!isSelf) {
    actions.push({
      id: MemberActionIds.Message,
      label: 'groups.members.message',
      icon: 'chatbubble-outline',
      color: 'info',
      tone: 'shade',
    });
  }
  if (!isOwner(viewerRole) || isSelf || member.role === GroupMemberRoles.Owner) {
    return actions;
  }
  if (member.role === GroupMemberRoles.Moderator) {
    actions.push({
      id: MemberActionIds.RemoveModerator,
      label: 'groups.members.removeModerator',
      hint: 'groups.members.removeModeratorHint',
      icon: 'shield-outline',
      color: 'violet',
    });
  } else {
    actions.push({
      id: MemberActionIds.MakeModerator,
      label: 'groups.members.makeModerator',
      hint: 'groups.members.makeModeratorHint',
      icon: 'shield-checkmark-outline',
      color: 'teal',
    });
  }
  actions.push({
    id: MemberActionIds.Remove,
    label: 'groups.members.remove',
    icon: 'person-remove-outline',
    color: 'danger',
    destructive: true,
  });
  return actions;
}
