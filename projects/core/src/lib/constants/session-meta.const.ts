import {
  CancelScope,
  FollowUpAudience,
  MyTab,
  SessionAccess,
  SessionInstanceStatus,
  SessionLocationKind,
  SessionMeetingProvider,
  SessionParticipantStatus,
  SessionReminderKind,
  SessionTemplateStatus,
  TemplateTab,
} from '../models/session/session.enums';

/**
 * Display metadata for the session-domain enums — the single source of the
 * words, hues, and icons every surface renders. Same contract as
 * `SESSION_TYPES`: tones are abstract names each platform maps to its own
 * paint (Tailwind/PrimeNG on web, `--ion-color-*` washes on mobile), and
 * icons carry a dialect per platform (`piIcon` PrimeIcons, `ionIcon`
 * ionicons) where both apps draw them.
 *
 * Deliberately NOT here: sentence-length, surface-specific copy — banners,
 * empty states, confirmation prose ("You're booked", "Request sent!"). That
 * is UX writing owned by the component that says it; only the identity of an
 * enum value (what it is called, what colour it wears, which glyph marks it)
 * is centralised.
 */

// ─── Access ───────────────────────────────────────────────────────────────

export type SessionAccessTone = 'teal' | 'success' | 'honey' | 'sky';

export interface SessionAccessMeta {
  label: string;
  /** One-line explanation, shown by the create forms and detail rows. */
  sub: string;
  tone: SessionAccessTone;
  piIcon: string;
  ionIcon: string;
}

export const SESSION_ACCESS_LEVELS: Record<SessionAccess, SessionAccessMeta> = {
  [SessionAccess.Open]: {
    label: 'Paid',
    sub: 'Anyone with the link can book.',
    tone: 'teal',
    piIcon: 'pi pi-money-bill',
    ionIcon: 'cash-outline',
  },
  [SessionAccess.Free]: {
    label: 'Free',
    sub: 'Listed publicly with no price tag.',
    tone: 'success',
    piIcon: 'pi pi-heart',
    ionIcon: 'heart-outline',
  },
  [SessionAccess.ClientsOnly]: {
    label: 'Clients only',
    sub: 'Only your active clients can book.',
    tone: 'honey',
    piIcon: 'pi pi-user',
    ionIcon: 'person-outline',
  },
  [SessionAccess.GroupOnly]: {
    label: 'Group members',
    sub: 'Only members of a specific group.',
    tone: 'sky',
    piIcon: 'pi pi-sitemap',
    ionIcon: 'people-outline',
  },
};

// ─── Location ─────────────────────────────────────────────────────────────

export type SessionLocationTone = 'teal' | 'honey';

export const SESSION_LOCATION_KINDS: Record<
  SessionLocationKind,
  { label: string; tone: SessionLocationTone; piIcon: string; ionIcon: string }
> = {
  [SessionLocationKind.InPerson]: {
    label: 'In-person',
    tone: 'honey',
    piIcon: 'pi pi-map-marker',
    ionIcon: 'location-outline',
  },
  [SessionLocationKind.Online]: {
    label: 'Online',
    tone: 'teal',
    piIcon: 'pi pi-video',
    ionIcon: 'videocam-outline',
  },
};

// ─── Meeting provider ─────────────────────────────────────────────────────

export const SESSION_MEETING_PROVIDERS: Record<
  SessionMeetingProvider,
  { label: string; piIcon: string }
> = {
  [SessionMeetingProvider.Zoom]: { label: 'Zoom', piIcon: 'pi pi-video' },
  [SessionMeetingProvider.GoogleMeet]: { label: 'Google Meet', piIcon: 'pi pi-google' },
  [SessionMeetingProvider.Teams]: { label: 'Teams', piIcon: 'pi pi-microsoft' },
};

/** "Zoom" / "Google Meet" / "Teams" — "Online" when unset or unrecognised. */
export function meetingProviderLabel(
  provider: SessionMeetingProvider | string | null | undefined
): string {
  return (
    (provider && SESSION_MEETING_PROVIDERS[provider as SessionMeetingProvider]?.label) || 'Online'
  );
}

// ─── Statuses ─────────────────────────────────────────────────────────────

/**
 * Status tones are named after PrimeNG severities so web passes them straight
 * to `p-tag`; mobile maps each name to an `--ion-color-*` wash.
 */
export type SessionStatusTone = 'success' | 'warn' | 'info' | 'danger' | 'secondary';

export const SESSION_PARTICIPANT_STATUSES: Record<
  SessionParticipantStatus,
  { label: string; tone: SessionStatusTone; piIcon: string }
> = {
  [SessionParticipantStatus.Confirmed]: {
    label: 'Confirmed',
    tone: 'success',
    piIcon: 'pi pi-verified',
  },
  [SessionParticipantStatus.PendingApproval]: {
    label: 'Pending',
    tone: 'warn',
    piIcon: 'pi pi-hourglass',
  },
  [SessionParticipantStatus.Waitlisted]: {
    label: 'Waitlisted',
    tone: 'info',
    piIcon: 'pi pi-clock',
  },
  [SessionParticipantStatus.Cancelled]: {
    label: 'Cancelled',
    tone: 'danger',
    piIcon: 'pi pi-times-circle',
  },
  [SessionParticipantStatus.Declined]: {
    label: 'Declined',
    tone: 'danger',
    piIcon: 'pi pi-times-circle',
  },
};

export const SESSION_INSTANCE_STATUSES: Record<
  SessionInstanceStatus,
  { label: string; tone: SessionStatusTone }
> = {
  [SessionInstanceStatus.Scheduled]: { label: 'Scheduled', tone: 'secondary' },
  [SessionInstanceStatus.InProgress]: { label: 'In progress', tone: 'success' },
  [SessionInstanceStatus.Completed]: { label: 'Completed', tone: 'secondary' },
  [SessionInstanceStatus.Cancelled]: { label: 'Cancelled', tone: 'danger' },
};

export const SESSION_TEMPLATE_STATUSES: Record<
  SessionTemplateStatus,
  { label: string; tone: SessionStatusTone }
> = {
  [SessionTemplateStatus.Active]: { label: 'Active', tone: 'success' },
  [SessionTemplateStatus.Ended]: { label: 'Ended', tone: 'secondary' },
  [SessionTemplateStatus.Cancelled]: { label: 'Cancelled', tone: 'danger' },
};

// ─── Reminders ────────────────────────────────────────────────────────────

/**
 * The reminder schedule as the API runs it — `startAt` minus each offset.
 * The offsets are domain truth (mirrored from the BE's booking flow), not
 * presentation, which is why they live beside the labels.
 */
export const SESSION_REMINDER_KINDS: Record<
  SessionReminderKind,
  { label: string; offsetMs: number }
> = {
  [SessionReminderKind.Reminder24h]: {
    label: '24 hours before',
    offsetMs: 24 * 3_600_000,
  },
  [SessionReminderKind.Reminder1h]: { label: '1 hour before', offsetMs: 3_600_000 },
};

// ─── Cancel scope ─────────────────────────────────────────────────────────

/** Labels only — the per-scope help copy is written per surface (mobile's
    weaves the occurrence date in). */
export const CANCEL_SCOPES: Record<CancelScope, { label: string }> = {
  [CancelScope.This]: { label: 'Only this session' },
  [CancelScope.ThisAndFuture]: { label: 'This and all future' },
  [CancelScope.Series]: { label: 'The whole series' },
};

// ─── Follow-up audience ───────────────────────────────────────────────────

export const FOLLOW_UP_AUDIENCES: Record<FollowUpAudience, { label: string }> = {
  [FollowUpAudience.All]: { label: 'Everyone' },
  [FollowUpAudience.Attended]: { label: 'Attended only' },
  [FollowUpAudience.NoShow]: { label: 'No-shows only' },
  [FollowUpAudience.UserIds]: { label: 'Selected people' },
};

// ─── Tabs ─────────────────────────────────────────────────────────────────

export const MY_TABS: Record<MyTab, { label: string; piIcon: string }> = {
  [MyTab.Upcoming]: { label: 'Upcoming', piIcon: 'pi pi-calendar' },
  [MyTab.PendingApproval]: { label: 'Pending', piIcon: 'pi pi-hourglass' },
  [MyTab.Waitlisted]: { label: 'Waitlisted', piIcon: 'pi pi-clock' },
  [MyTab.Past]: { label: 'Past', piIcon: 'pi pi-history' },
  [MyTab.Cancelled]: { label: 'Cancelled', piIcon: 'pi pi-times-circle' },
};

/** `Active` reads "Upcoming" and `Ended` reads "Past" on purpose — the enum
    names the template state, the label names what the coach is looking at. */
export const TEMPLATE_TABS: Record<TemplateTab, { label: string; piIcon: string }> = {
  [TemplateTab.Active]: { label: 'Upcoming', piIcon: 'pi pi-calendar' },
  [TemplateTab.Recurring]: { label: 'Recurring templates', piIcon: 'pi pi-replay' },
  [TemplateTab.Ended]: { label: 'Past', piIcon: 'pi pi-history' },
  [TemplateTab.Cancelled]: { label: 'Cancelled', piIcon: 'pi pi-times-circle' },
};
