import { MyTab, SessionParticipantStatus } from 'core';
import {
  alertCircleOutline,
  calendarOutline,
  checkmarkCircleOutline,
  chevronBack,
  chevronForward,
  compassOutline,
  linkOutline,
  locationOutline,
  peopleOutline,
  personOutline,
  timeOutline,
  videocamOutline,
} from 'ionicons/icons';

/** Every icon these screens render, registered once per page. */
export const MY_SESSION_ICONS = {
  alertCircleOutline,
  calendarOutline,
  checkmarkCircleOutline,
  chevronBack,
  chevronForward,
  compassOutline,
  linkOutline,
  locationOutline,
  peopleOutline,
  personOutline,
  timeOutline,
  videocamOutline,
};

/**
 * `GET /sessions/my` serves five buckets; the header shows two.
 *
 * Awaiting-approval and waitlisted bookings *are* upcoming — future sessions
 * you do not have a confirmed seat for — so splitting them out made "what have
 * I got coming up" a question you had to ask three times. They merge into
 * Upcoming, where each row states its own status.
 *
 * Cancelled does not get a header seat: it is a thing you check rarely and
 * never scan. It sits under the list as a single row, which costs one tap and
 * buys back a third of the header.
 */
export const BOOKING_TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
] as const;

export type BookingTab = (typeof BOOKING_TABS)[number]['key'];

/** The API buckets behind each tab, in the order they merge. */
export const TAB_SOURCES: Record<BookingTab | 'cancelled', readonly MyTab[]> = {
  upcoming: ['upcoming', 'pendingApproval', 'waitlisted'],
  past: ['past'],
  cancelled: ['cancelled'],
};

/**
 * How the booking reads, which is not the same question as how the session
 * reads. A confirmed booking on a cancelled session still says "Booked" here;
 * the session's own state is the row's second line.
 */
export function bookingStatusLabel(status: SessionParticipantStatus): string {
  switch (status) {
    case SessionParticipantStatus.Confirmed:
      return 'Booked';
    case SessionParticipantStatus.PendingApproval:
      return 'Awaiting approval';
    case SessionParticipantStatus.Waitlisted:
      return 'On the waitlist';
    case SessionParticipantStatus.Cancelled:
      return 'Cancelled';
    case SessionParticipantStatus.Declined:
      return 'Declined';
    default:
      return '';
  }
}

export function bookingStatusColor(status: SessionParticipantStatus): string {
  switch (status) {
    case SessionParticipantStatus.Confirmed:
      return 'success';
    case SessionParticipantStatus.PendingApproval:
      return 'warning';
    case SessionParticipantStatus.Waitlisted:
      return 'info';
    default:
      return 'medium';
  }
}

/**
 * Row spine, keyed to the booking rather than the session type.
 *
 * The coach's agenda colours by type, because their question is what kind of
 * session is next. A trainee's question is "do I have a seat", so the spine
 * answers that instead: emerald booked, honey awaiting, sky waitlist, slate
 * for anything already settled.
 */
export function bookingTone(
  status: SessionParticipantStatus,
  isPast: boolean,
): 'emerald' | 'honey' | 'sky' | 'slate' {
  if (isPast) return 'slate';
  switch (status) {
    case SessionParticipantStatus.Confirmed:
      return 'emerald';
    case SessionParticipantStatus.PendingApproval:
      return 'honey';
    case SessionParticipantStatus.Waitlisted:
      return 'sky';
    default:
      return 'slate';
  }
}
