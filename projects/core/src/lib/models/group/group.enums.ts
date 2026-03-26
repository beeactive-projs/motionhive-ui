export const JoinPolicies = {
  Open: 'OPEN',
  Approval: 'APPROVAL',
  InviteOnly: 'INVITE_ONLY',
} as const;

export type JoinPolicy = (typeof JoinPolicies)[keyof typeof JoinPolicies];
