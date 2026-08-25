import {
  alertCircleOutline,
  calendarOutline,
  checkmarkCircleOutline,
  checkmarkOutline,
  chevronForward,
  closeCircleOutline,
  copyOutline,
  documentTextOutline,
  hourglassOutline,
  lockClosedOutline,
  locationOutline,
  peopleOutline,
  pricetagOutline,
  timeOutline,
  videocamOutline,
} from 'ionicons/icons';

import {
  BlockedSessionInstance,
  JoinInfo,
  PublicSessionInstance,
  SessionInstanceStatus,
  SessionInstructorRef,
  SessionLocationKind,
  SessionParticipant,
  SessionParticipantStatus,
  isBlockedInstance,
  joinPhase,
  joinWindowFor,
  sessionLifecycle,
  sessionMinutes,
} from 'core';

/**
 * The trainee sessions surface's pure brain: spine tones, chips, meta lines,
 * the detail screen's state machine, and the cancel sheet's copy variants.
 *
 * Everything here derives from a `SessionParticipant` (the booking) and a
 * clock — no signals, no Ionic — so the invariants the design fixes ("booked
 * rows carry no chip", "never render a queue position") are testable without
 * a component in sight. The coach twin is `../../coach/sessions/sessions.config.ts`.
 */

/** Every icon this feature renders — same guard idea as the coach config. */
export const MY_SESSION_ICONS = {
  alertCircleOutline,
  calendarOutline,
  checkmarkCircleOutline,
  checkmarkOutline,
  chevronForward,
  closeCircleOutline,
  copyOutline,
  documentTextOutline,
  hourglassOutline,
  lockClosedOutline,
  locationOutline,
  peopleOutline,
  pricetagOutline,
  timeOutline,
  videocamOutline,
};

// ─── Spine tone ────────────────────────────────────────────────────────────

/**
 * The row spine answers the trainee's question — "do I have a seat" — so it
 * is keyed to the BOOKING status, never the session type the coach rows use.
 */
export const MyBookingTones = {
  /** Confirmed seat — emerald. The default state is silent (no chip). */
  Booked: 'booked',
  /** Awaiting the coach's approval — honey. */
  Pending: 'pending',
  /** On the waitlist — sky. */
  Waitlist: 'waitlist',
  /** Past, cancelled or declined — slate. A record, not a call to action. */
  Muted: 'muted',
} as const;

export type MyBookingTone = (typeof MyBookingTones)[keyof typeof MyBookingTones];

export function bookingTone(p: SessionParticipant, now: number): MyBookingTone {
  if (
    p.status === SessionParticipantStatus.Cancelled ||
    p.status === SessionParticipantStatus.Declined
  ) {
    return MyBookingTones.Muted;
  }
  if (bookingLifecycle(p, now) === 'past') return MyBookingTones.Muted;
  switch (p.status) {
    case SessionParticipantStatus.Confirmed:
      return MyBookingTones.Booked;
    case SessionParticipantStatus.PendingApproval:
      return MyBookingTones.Pending;
    case SessionParticipantStatus.Waitlisted:
      return MyBookingTones.Waitlist;
    default:
      return MyBookingTones.Muted;
  }
}

// ─── Chip ──────────────────────────────────────────────────────────────────

/** Wash tone names — the badge SCSS maps each to an `--ion-color-*-wash`. */
export interface BookingChip {
  label: string;
  tone: 'success' | 'warn' | 'info' | 'medium';
}

/**
 * The one chip a row may carry, or null. Booked-and-upcoming is deliberately
 * chipless — the emerald spine already says it, and a "Booked" chip on every
 * row would bury the exceptions this list exists to surface.
 *
 * A queue position is NEVER part of the waitlist chip: the backend column is
 * always null and arrival order is all that exists, so the UI must not imply
 * a number it cannot honour.
 */
export function bookingChip(p: SessionParticipant, now: number): BookingChip | null {
  switch (p.status) {
    case SessionParticipantStatus.PendingApproval:
      return { label: 'Awaiting approval', tone: 'warn' };
    case SessionParticipantStatus.Waitlisted:
      return { label: 'Waitlist', tone: 'info' };
    // The cancelled list is the only place these rows render, muted on
    // purpose — danger would shout about something already over.
    case SessionParticipantStatus.Cancelled:
      return { label: 'Cancelled', tone: 'medium' };
    case SessionParticipantStatus.Declined:
      return { label: 'Declined', tone: 'medium' };
    default:
      break;
  }
  // Confirmed: silent while upcoming, the attendance record once it is over.
  if (bookingLifecycle(p, now) !== 'past') return null;
  if (p.attended === true) return { label: 'Attended', tone: 'success' };
  if (p.attended === false) return { label: 'Missed', tone: 'medium' };
  return null;
}

// ─── Accessors (guarding the eager-loaded refs) ────────────────────────────

export function bookingTitle(p: SessionParticipant): string {
  return p.instance?.titleOverride ?? p.instance?.template?.title ?? 'Session';
}

export function bookingLifecycle(
  p: SessionParticipant,
  now: number,
): 'upcoming' | 'ongoing' | 'past' {
  return sessionLifecycle(p.instance?.startAt, p.instance?.endAt, now);
}

export function bookingCoach(p: SessionParticipant): SessionInstructorRef | null {
  return p.instance?.instructor ?? p.instance?.template?.instructor ?? null;
}

export function isOnlineBooking(p: SessionParticipant): boolean {
  return p.instance?.template?.locationKind === SessionLocationKind.Online;
}

/** "Online" or the venue's name — the snapshot text is the last resort. */
export function bookingPlace(p: SessionParticipant): string {
  if (isOnlineBooking(p)) return 'Online';
  return (
    p.instance?.venueOverride?.name ??
    p.instance?.template?.venue?.name ??
    p.snapshotLocationText ??
    ''
  );
}

/** "with Ana · Herăstrău loop" — the row's second line. */
export function bookingMeta(p: SessionParticipant): string {
  const first = bookingCoach(p)?.firstName?.trim();
  const place = bookingPlace(p);
  return [first ? `with ${first}` : '', place].filter(Boolean).join(' · ');
}

export function bookingDurationMinutes(p: SessionParticipant): number {
  const fromTemplate = p.instance?.template?.durationMinutes;
  if (fromTemplate) return fromTemplate;
  return p.instance ? sessionMinutes(p.instance) : 0;
}

/**
 * "Free" / "50 RON" / "49.50 RON". Not the web's `currencyRon` pipe — the
 * design reads whole amounts without decimals, and the currency code comes
 * from the booking snapshot rather than being assumed.
 */
export function bookingPriceLabel(cents: number, currency: string): string {
  if (cents <= 0) return 'Free';
  const amount = cents / 100;
  const rendered = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${rendered} ${currency.toUpperCase()}`;
}

// ─── Join window ───────────────────────────────────────────────────────────

/**
 * The server's `JoinInfo` instants when we have them, the derived contract
 * window when we do not (the fallback for a `joinInfo` 403).
 */
export function bookingJoinWindow(
  startAt: string,
  joinInfo: JoinInfo | null,
): { from: Date; until: Date } {
  if (joinInfo) {
    return {
      from: new Date(joinInfo.joinActiveFrom),
      until: new Date(joinInfo.joinActiveUntil),
    };
  }
  return joinWindowFor(startAt);
}

/**
 * Whether the row swaps its chevron for the honey Join pill — a confirmed
 * seat in an online session whose join window is open right now. The list
 * has no `joinInfo` (that is one call per booking), so this reads the
 * derived window; the tap itself re-verifies through `joinInfo`.
 */
export function showJoinPill(p: SessionParticipant, now: number): boolean {
  if (p.status !== SessionParticipantStatus.Confirmed) return false;
  if (!isOnlineBooking(p)) return false;
  const startAt = p.instance?.startAt;
  if (!startAt) return false;
  if (p.instance?.status === SessionInstanceStatus.Cancelled) return false;
  const { from, until } = joinWindowFor(startAt);
  return joinPhase(from, until, now) === 'open';
}

// ─── Detail state machine ──────────────────────────────────────────────────

/** Which of the design's detail states the screen is in. */
export const DetailViews = {
  /** Group-members-only session the trainee cannot see into (violet). */
  Blocked: 'blocked',
  /** The coach cancelled the occurrence itself. */
  CancelledInstance: 'cancelledInstance',
  /** No active booking — the public showcase, with Book when bookable. */
  Showcase: 'showcase',
  /** Confirmed, in person, still ahead. */
  BookedInPerson: 'bookedInPerson',
  /** Confirmed, online, before the join window opens. */
  OnlinePre: 'onlinePre',
  /** Confirmed, online, join window open — live now. */
  OnlineLive: 'onlineLive',
  /** Awaiting the coach's approval. */
  Pending: 'pending',
  /** On the waitlist. */
  Waitlist: 'waitlist',
  /** A record: over, join window closed, or attendance marked. */
  Past: 'past',
} as const;

export type DetailView = (typeof DetailViews)[keyof typeof DetailViews];

/**
 * One pure function decides which screen the detail page renders, so the
 * design's trickiest behaviour — the 3g→3h flip happening in place on a
 * clock tick, and the live screen decaying to a past record at start+15 —
 * is a table of (status × location × clock) cases rather than template
 * conditions.
 */
export function detailView(
  instance: PublicSessionInstance | BlockedSessionInstance | null,
  booking: SessionParticipant | null,
  joinInfo: JoinInfo | null,
  now: number,
): DetailView | null {
  if (!instance) return null;
  if (isBlockedInstance(instance)) return DetailViews.Blocked;
  if (instance.status === SessionInstanceStatus.Cancelled) {
    return DetailViews.CancelledInstance;
  }

  const lifecycle = sessionLifecycle(instance.startAt, instance.endAt, now);

  switch (booking?.status) {
    case SessionParticipantStatus.Confirmed: {
      if (instance.template?.locationKind === SessionLocationKind.Online) {
        const { from, until } = bookingJoinWindow(instance.startAt, joinInfo);
        const phase = joinPhase(from, until, now);
        if (phase === 'before') return DetailViews.OnlinePre;
        if (phase === 'open') return DetailViews.OnlineLive;
        // The window closed at start+15 — the screen becomes a record even
        // while the class itself may still be running.
        return DetailViews.Past;
      }
      return lifecycle === 'past' ? DetailViews.Past : DetailViews.BookedInPerson;
    }
    case SessionParticipantStatus.PendingApproval:
      return lifecycle === 'past' ? DetailViews.Past : DetailViews.Pending;
    case SessionParticipantStatus.Waitlisted:
      return lifecycle === 'past' ? DetailViews.Past : DetailViews.Waitlist;
    default:
      // No booking, or one already cancelled/declined — the public view.
      // The template suppresses Book once the session is over.
      return DetailViews.Showcase;
  }
}

// ─── Cancel sheet variants ─────────────────────────────────────────────────

export interface CancelSheetVariant {
  title: string;
  saveLabel: string;
  dismissLabel: string;
  /** Terms + late-cancel cards only apply to a confirmed seat. */
  showTerms: boolean;
  /** What the toast says on success (confirmed seats derive theirs from the
      response's within/outside-window verdict instead). */
  successToast: string | null;
}

const CANCEL_SHEET_VARIANTS: Partial<
  Record<SessionParticipantStatus, CancelSheetVariant>
> = {
  [SessionParticipantStatus.Confirmed]: {
    title: 'Cancel this booking?',
    saveLabel: 'Cancel booking',
    dismissLabel: 'Keep booking',
    showTerms: true,
    successToast: null,
  },
  [SessionParticipantStatus.Waitlisted]: {
    title: 'Leave the waitlist?',
    saveLabel: 'Leave waitlist',
    dismissLabel: 'Keep my spot',
    showTerms: false,
    successToast: 'You left the waitlist.',
  },
  [SessionParticipantStatus.PendingApproval]: {
    title: 'Withdraw request?',
    saveLabel: 'Withdraw request',
    dismissLabel: 'Keep request',
    showTerms: false,
    successToast: 'Request withdrawn.',
  },
};

/** Falls back to the confirmed variant — the only state with real stakes. */
export function cancelSheetVariant(
  status: SessionParticipantStatus | null | undefined,
): CancelSheetVariant {
  return (
    (status && CANCEL_SHEET_VARIANTS[status]) ||
    CANCEL_SHEET_VARIANTS[SessionParticipantStatus.Confirmed]!
  );
}
