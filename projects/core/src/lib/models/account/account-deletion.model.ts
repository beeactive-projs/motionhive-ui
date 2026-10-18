import { HttpErrorResponse } from '@angular/common/http';

/** Codes the API puts on deletion-related errors, for the apps to branch on. */
export const AccountDeletionErrorCodes = {
  /** Sign-in during the cooling-off: offer to keep the account. */
  ScheduledForDeletion: 'ACCOUNT_SCHEDULED_FOR_DELETION',
  /** A coach's dispute needs their answer before they can leave. */
  OpenDispute: 'OPEN_DISPUTE',
} as const;

export type AccountDeletionBlocker = 'OPEN_DISPUTE';

/**
 * What deleting the account would end, counted by the API before anyone
 * confirms (`GET /users/me/deletion/preview`). Coach numbers are all zero
 * for someone who does not coach.
 */
export interface AccountDeletionPreview {
  /** Where the code goes. */
  email: string;
  /** When the data would be erased if confirmed now (ISO). */
  scheduledFor: string;
  coolingOffDays: number;
  asMember: {
    subscriptions: number;
    bookings: number;
    coaches: number;
    groups: number;
  };
  asCoach: {
    clients: number;
    subscriptions: number;
    upcomingSessions: number;
    bookedPeople: number;
    groups: number;
    groupMembers: number;
  };
  blockers: AccountDeletionBlocker[];
}

/** A sign-in that found the account in its deletion cooling-off. */
export interface ScheduledDeletion {
  /** Opens `POST /auth/restore-account`, for 15 minutes. */
  restoreTicket: string;
  /** When the data will be erased (ISO). */
  scheduledFor: string;
  /** The API's sentence, in the reader's language. */
  message: string;
}

/**
 * The cooling-off offer inside a failed sign-in, or null for any other
 * error. The sign-in screens call this before showing a plain error.
 */
export function scheduledDeletionFrom(err: unknown): ScheduledDeletion | null {
  if (!(err instanceof HttpErrorResponse) || err.status !== 403) return null;
  const body: unknown = err.error;
  if (typeof body !== 'object' || body === null) return null;
  const { code, restoreTicket, scheduledFor, message } = body as Record<string, unknown>;
  if (code !== AccountDeletionErrorCodes.ScheduledForDeletion) return null;
  if (typeof restoreTicket !== 'string' || typeof scheduledFor !== 'string') return null;
  return {
    restoreTicket,
    scheduledFor,
    message: typeof message === 'string' ? message : '',
  };
}
