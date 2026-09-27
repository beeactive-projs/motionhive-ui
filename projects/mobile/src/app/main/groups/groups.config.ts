import {
  Group,
  WEB_APP_URL,
  GroupMemberPostPolicies,
  GroupMemberPostPolicy,
  GroupMemberRole,
  GroupMemberRoles,
  JoinPolicies,
  JoinPolicy,
} from 'core';

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
    return { action: JoinActions.Pending, label: 'Request pending', enabled: false };
  }
  switch (policy) {
    case JoinPolicies.Open:
      return { action: JoinActions.Join, label: 'Join group', enabled: true };
    case JoinPolicies.Approval:
      return { action: JoinActions.Request, label: 'Request to join', enabled: true };
    case JoinPolicies.InviteOnly:
      return { action: JoinActions.Closed, label: 'Invite only', enabled: false };
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
  switch (policy) {
    case JoinPolicies.Open:
      return 'Open';
    case JoinPolicies.Approval:
      return 'Approval required';
    case JoinPolicies.InviteOnly:
      return 'Invite only';
  }
}

/** Ionic colour slot for the policy chip. */
export function joinPolicyTone(policy: JoinPolicy): string {
  switch (policy) {
    case JoinPolicies.Open:
      return 'success';
    case JoinPolicies.Approval:
      return 'warning';
    case JoinPolicies.InviteOnly:
      return 'medium';
  }
}

/** Ionic colour slot for the role chip on a member row. */
export function memberRoleTone(role: GroupMemberRole): string {
  switch (role) {
    case GroupMemberRoles.Owner:
      return 'primary';
    case GroupMemberRoles.Moderator:
      return 'info';
    case GroupMemberRoles.Member:
      return 'medium';
  }
}

export function memberRoleLabel(role: GroupMemberRole): string {
  switch (role) {
    case GroupMemberRoles.Owner:
      return 'Owner';
    case GroupMemberRoles.Moderator:
      return 'Moderator';
    case GroupMemberRoles.Member:
      return 'Member';
  }
}

// ── Form options ─────────────────────────────────────────────────────────

/**
 * What each join policy means, in the order a new group should consider
 * them. The description matters more than the label here: "Approval" alone
 * tells an owner nothing about who ends up reviewing what.
 */
export const JOIN_POLICY_OPTIONS: ReadonlyArray<{
  value: JoinPolicy;
  label: string;
  hint: string;
}> = [
  { value: JoinPolicies.Open, label: 'Open', hint: 'Anyone can join instantly.' },
  {
    value: JoinPolicies.Approval,
    label: 'Approval required',
    hint: 'People request to join and you decide.',
  },
  {
    value: JoinPolicies.InviteOnly,
    label: 'Invite only',
    hint: 'Only people you invite can join.',
  },
];

/** Who may post, and whether it waits for review. */
export const POST_POLICY_OPTIONS: ReadonlyArray<{
  value: GroupMemberPostPolicy;
  label: string;
  hint: string;
}> = [
  {
    value: GroupMemberPostPolicies.Open,
    label: 'Anyone can post',
    hint: 'Members post straight to the feed.',
  },
  {
    value: GroupMemberPostPolicies.ApprovalRequired,
    label: 'Posts need approval',
    hint: 'You and your moderators review each one.',
  },
  {
    value: GroupMemberPostPolicies.Disabled,
    label: 'Only staff can post',
    hint: 'Members can read and comment.',
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
 * The path is `/join/<token>`, which is where web's `mainRoutes` actually
 * mounts its accept screen. Web's own copy button builds
 * `/groups/join/<token>` and 404s — worth fixing there, but this generates
 * the address that works.
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
