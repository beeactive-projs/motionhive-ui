/**
 * Named windows used by stores that query date-ranged session endpoints.
 *
 * Centralizing these so a product change ("show 4 weeks instead of 2") is
 * a one-line tweak and doesn't require grepping `* 86_400_000` across the
 * codebase. All values are in milliseconds.
 */

const ONE_DAY_MS = 86_400_000;

export const DateWindowsMs = {
  /** How far ahead the instructor's list pulls upcoming-instance summaries. */
  InstructorListAhead: 14 * ONE_DAY_MS,

  /** Cancelled-instances lookback window for the Cancelled tab. */
  CancelledLookback: 90 * ONE_DAY_MS,

  /** Cancelled-instances lookahead (future-cancelled e.g. recurring series). */
  CancelledLookahead: 30 * ONE_DAY_MS,

  /** Approvals inbox horizon (instructor side). */
  ApprovalsHorizon: 60 * ONE_DAY_MS,

  /** Template-detail occurrences list lookback. */
  TemplateLookback: 30 * ONE_DAY_MS,

  /** Template-detail occurrences list lookahead (must stay <= BE 180-day cap). */
  TemplateLookahead: 149 * ONE_DAY_MS,
} as const;
