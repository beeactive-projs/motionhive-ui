export const JoinPolicies = {
  Open: 'OPEN',
  Approval: 'APPROVAL',
  InviteOnly: 'INVITE_ONLY',
} as const;

export type JoinPolicy = (typeof JoinPolicies)[keyof typeof JoinPolicies];

export const GroupMemberRoles = {
  Member: 'MEMBER',
  Moderator: 'MODERATOR',
  Owner: 'OWNER',
} as const;

export type GroupMemberRole =
  (typeof GroupMemberRoles)[keyof typeof GroupMemberRoles];

export const GroupMemberPostPolicies = {
  Disabled: 'DISABLED',
  Open: 'OPEN',
  ApprovalRequired: 'APPROVAL_REQUIRED',
} as const;

export type GroupMemberPostPolicy =
  (typeof GroupMemberPostPolicies)[keyof typeof GroupMemberPostPolicies];

export const PostApprovalStates = {
  Approved: 'APPROVED',
  Pending: 'PENDING',
  Rejected: 'REJECTED',
} as const;

export type PostApprovalState =
  (typeof PostApprovalStates)[keyof typeof PostApprovalStates];
