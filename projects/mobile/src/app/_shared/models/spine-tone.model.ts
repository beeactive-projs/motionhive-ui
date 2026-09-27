/**
 * The spine vocabulary of the `.mh-session-row` skin
 * (theme/components/mh-session-row.css), so a row cannot name a colour the
 * stylesheet does not paint. An unknown value leaves `--spine` unset and the
 * row renders with no spine at all — which is how ACTIVE assignments once
 * shipped invisible.
 *
 * Type/lifecycle tones (honey, teal, violet, navy, coral) come from the coach
 * agenda; booking-status tones (booked, pending, waitlist) from the trainee
 * list; the plain semantic tones (danger, warning, info) from the Clients
 * triage. `muted` is the record: done, skipped, archived.
 */
export const SpineTones = {
  Honey: 'honey',
  Pending: 'pending',
  Teal: 'teal',
  Violet: 'violet',
  Navy: 'navy',
  Waitlist: 'waitlist',
  Booked: 'booked',
  Coral: 'coral',
  Muted: 'muted',
  Danger: 'danger',
  Warning: 'warning',
  Info: 'info',
} as const;

export type SpineTone = (typeof SpineTones)[keyof typeof SpineTones];
