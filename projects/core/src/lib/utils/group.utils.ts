import { JoinPolicies, type JoinPolicy } from '../models/group/group.enums';
import { TagSeverity } from '../models/common/ui.enums';
import { enumLabel } from '../i18n/enum-label';

/**
 * PrimeNG tag severity for a group's join policy.
 * - OPEN     → success (anyone can join)
 * - APPROVAL → warn    (request needs approval)
 * - INVITE_ONLY → info (closed)
 */
export function joinPolicySeverity(policy: JoinPolicy): TagSeverity {
  switch (policy) {
    case JoinPolicies.Open:
      return TagSeverity.Success;
    case JoinPolicies.Approval:
      return TagSeverity.Warn;
    case JoinPolicies.InviteOnly:
      return TagSeverity.Info;
  }
}

/** Short label for a group's join policy ("Open" / "Approval" / "Invite only"). */
export function joinPolicyLabel(policy: JoinPolicy): string {
  return enumLabel('joinPolicy', policy);
}
