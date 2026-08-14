/**
 * The coach's roster: who is on track and who is slipping, without
 * opening each client. Derived server-side from assigned workout
 * statuses and logs — nothing is captured specially for it.
 */

export type RosterWindow = '1w' | '4w';

/**
 * Why a client needs looking at. Null when they don't.
 *   NEVER_STARTED — assigned work, nothing ever logged
 *   SILENT        — no workout in 14+ days
 *   DROPPED       — adherence fell 20+ points against the prior window
 *   BEHIND        — under half the work due in the window
 */
export type RosterAttention =
  | 'NEVER_STARTED'
  | 'SILENT'
  | 'DROPPED'
  | 'BEHIND'
  | null;

export interface RosterClient {
  clientId: string;
  name: string;
  avatarUrl: string | null;
  handle: string | null;
  due: number;
  completed: number;
  skipped: number;
  /** Null when nothing was due, which is not the same as 0%. */
  adherencePercent: number | null;
  previousAdherencePercent: number | null;
  lastWorkoutAt: string | null;
  daysSinceLastWorkout: number | null;
  activePlans: number;
  attention: RosterAttention;
}

export interface RosterSummary {
  window: RosterWindow;
  /** Needs-attention first, then least adherent. */
  clients: RosterClient[];
  totals: {
    clients: number;
    needsAttention: number;
    /** Mean across clients who had work due. */
    adherencePercent: number | null;
  };
}
