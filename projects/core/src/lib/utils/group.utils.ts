import { JoinPolicies, type JoinPolicy } from '../models/group/group.enums';
import { TagSeverity } from '../models/common/ui.enums';

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

/** Human-readable label for a group's join policy. Sentence case. */
export function joinPolicyLabel(policy: JoinPolicy): string {
  switch (policy) {
    case JoinPolicies.Open:
      return 'Open';
    case JoinPolicies.Approval:
      return 'Approval';
    case JoinPolicies.InviteOnly:
      return 'Invite only';
  }
}
