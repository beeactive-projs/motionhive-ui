import type { BadgeTone, IconName } from './public-profile-view.model';

/**
 * Credibility badge surfaced in the hero badge strip. Backend computes
 * each badge (verified coach, top rated 2025, fast responder, …) — the
 * UI just renders the payload. See the design contract §5 for the
 * authoritative award table.
 */
export interface ProfileBadge {
  id: string;
  icon: IconName;
  label: string;
  /** Optional one-line sub-label, only shown in the `ribbon` style. */
  sub?: string;
  tone: BadgeTone;
  /** Optional tooltip text shown on hover/focus. */
  title?: string;
}
