import type { ProgramAssignmentStatus } from './workout.enums';

/**
 * A client's deep-copy assignment of a program. Created server-side
 * via copy-on-assign (locked decision §10). The assigned tree
 * (assigned_workout → assigned_exercise → assigned_set) is the
 * client's authoritative copy.
 */
export interface ProgramAssignment {
  id: string;
  instructorId: string;
  clientId: string;
  instructorClientId: string | null;
  masterProgramId: string | null;
  programNameSnapshot: string;
  status: ProgramAssignmentStatus;
  /** ISO date (YYYY-MM-DD). */
  startDate: string;
  /** ISO date or null when the program has no fixed duration. */
  endDate: string | null;
  completionPercent: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  // Eager-loaded references
  instructor?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    handle: string | null;
  };
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    handle: string | null;
  };
}

// ─── Query / payload shapes ──────────────────────────────────────────

export interface ListAssignmentsQuery {
  page?: number;
  limit?: number;
  status?: ProgramAssignmentStatus;
  /** Instructor-side only — narrows to one client. */
  clientId?: string;
}

export interface PaginatedAssignments {
  items: ProgramAssignment[];
  total: number;
  page: number;
  pageSize: number;
}

/** Body for `POST /program-assignments`. Triggers the deep-copy tx. */
export interface AssignProgramPayload {
  programId: string;
  clientId: string;
  /** ISO date — day 0 of the program lands here. */
  startDate: string;
  notes?: string;
}

/** Body for `PATCH /program-assignments/:id`. Instructor-only. */
export interface UpdateAssignmentPayload {
  status?: ProgramAssignmentStatus;
  notes?: string;
}
