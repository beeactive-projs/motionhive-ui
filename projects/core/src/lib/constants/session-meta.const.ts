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
import { withEnumLabels } from '../i18n/enum-label';
import { translate } from '../i18n/translator';

/**
 * Display metadata for the session-domain enums — the single source of the
 * words, hues, and icons every surface renders. Same contract as
 * `SESSION_TYPES`: tones are abstract names each platform maps to its own
 * paint (Tailwind/PrimeNG on web, `--ion-color-*` washes on mobile), and
 * icons carry a dialect per platform (`piIcon` PrimeIcons, `ionIcon`
 * ionicons) where both apps draw them.
 *
 * The words are translation keys (`enum.<domain>.<VALUE>`) read through
 * `label` getters, so every `SESSION_*[value].label` stays a plain string.
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

export const SESSION_ACCESS_LEVELS: Record<SessionAccess, SessionAccessMeta> = withAccessHints(
  withEnumLabels('sessionAccess', {
    [SessionAccess.Open]: { tone: 'teal' as const, piIcon: 'pi pi-money-bill', ionIcon: 'cash-outline' },
    [SessionAccess.Free]: { tone: 'success' as const, piIcon: 'pi pi-heart', ionIcon: 'heart-outline' },
    [SessionAccess.ClientsOnly]: {
      tone: 'honey' as const,
      piIcon: 'pi pi-user',
      ionIcon: 'person-outline',
    },
    [SessionAccess.GroupOnly]: {
      tone: 'sky' as const,
      piIcon: 'pi pi-sitemap',
      ionIcon: 'people-outline',
    },
  }),
);

/** `sub` getters from `enum.sessionAccessHint.<VALUE>`. */
function withAccessHints<T extends object>(
  record: Record<SessionAccess, T>,
): Record<SessionAccess, T & { sub: string }> {
  for (const value of Object.keys(record) as SessionAccess[]) {
    Object.defineProperty(record[value], 'sub', {
      get: () => translate(`enum.sessionAccessHint.${value}`),
      enumerable: true,
    });
  }
  return record as Record<SessionAccess, T & { sub: string }>;
}

// ─── Location ─────────────────────────────────────────────────────────────

export type SessionLocationTone = 'teal' | 'honey';

export const SESSION_LOCATION_KINDS: Record<
  SessionLocationKind,
  { label: string; tone: SessionLocationTone; piIcon: string; ionIcon: string }
> = withEnumLabels('sessionLocationKind', {
  [SessionLocationKind.InPerson]: {
    tone: 'honey' as const,
    piIcon: 'pi pi-map-marker',
    ionIcon: 'location-outline',
  },
  [SessionLocationKind.Online]: {
    tone: 'teal' as const,
    piIcon: 'pi pi-video',
    ionIcon: 'videocam-outline',
  },
});

// ─── Meeting provider ─────────────────────────────────────────────────────

/** Product names — the same in every language, so not translated. */
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
    (provider && SESSION_MEETING_PROVIDERS[provider as SessionMeetingProvider]?.label) ||
    SESSION_LOCATION_KINDS[SessionLocationKind.Online].label
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
> = withEnumLabels('sessionParticipantStatus', {
  [SessionParticipantStatus.Confirmed]: { tone: 'success' as const, piIcon: 'pi pi-verified' },
  [SessionParticipantStatus.PendingApproval]: { tone: 'warn' as const, piIcon: 'pi pi-hourglass' },
  [SessionParticipantStatus.Waitlisted]: { tone: 'info' as const, piIcon: 'pi pi-clock' },
  [SessionParticipantStatus.Cancelled]: { tone: 'danger' as const, piIcon: 'pi pi-times-circle' },
  [SessionParticipantStatus.Declined]: { tone: 'danger' as const, piIcon: 'pi pi-times-circle' },
});

export const SESSION_INSTANCE_STATUSES: Record<
  SessionInstanceStatus,
  { label: string; tone: SessionStatusTone }
> = withEnumLabels('sessionInstanceStatus', {
  [SessionInstanceStatus.Scheduled]: { tone: 'secondary' as const },
  [SessionInstanceStatus.InProgress]: { tone: 'success' as const },
  [SessionInstanceStatus.Completed]: { tone: 'secondary' as const },
  [SessionInstanceStatus.Cancelled]: { tone: 'danger' as const },
});

export const SESSION_TEMPLATE_STATUSES: Record<
  SessionTemplateStatus,
  { label: string; tone: SessionStatusTone }
> = withEnumLabels('sessionTemplateStatus', {
  [SessionTemplateStatus.Active]: { tone: 'success' as const },
  [SessionTemplateStatus.Ended]: { tone: 'secondary' as const },
  [SessionTemplateStatus.Cancelled]: { tone: 'danger' as const },
});

// ─── Reminders ────────────────────────────────────────────────────────────

/**
 * The reminder schedule as the API runs it — `startAt` minus each offset.
 * The offsets are domain truth (mirrored from the BE's booking flow), not
 * presentation, which is why they live beside the labels.
 */
export const SESSION_REMINDER_KINDS: Record<
  SessionReminderKind,
  { label: string; offsetMs: number }
> = withEnumLabels('sessionReminderKind', {
  [SessionReminderKind.Reminder24h]: { offsetMs: 24 * 3_600_000 },
  [SessionReminderKind.Reminder1h]: { offsetMs: 3_600_000 },
});

// ─── Cancel scope ─────────────────────────────────────────────────────────

/** Labels only — the per-scope help copy is written per surface (mobile's
    weaves the occurrence date in). */
export const CANCEL_SCOPES: Record<CancelScope, { label: string }> = withEnumLabels('cancelScope', {
  [CancelScope.This]: {},
  [CancelScope.ThisAndFuture]: {},
  [CancelScope.Series]: {},
});

// ─── Follow-up audience ───────────────────────────────────────────────────

export const FOLLOW_UP_AUDIENCES: Record<FollowUpAudience, { label: string }> = withEnumLabels(
  'followUpAudience',
  {
    [FollowUpAudience.All]: {},
    [FollowUpAudience.Attended]: {},
    [FollowUpAudience.NoShow]: {},
    [FollowUpAudience.UserIds]: {},
  },
);

// ─── Tabs ─────────────────────────────────────────────────────────────────

export const MY_TABS: Record<MyTab, { label: string; piIcon: string }> = withEnumLabels('myTab', {
  [MyTab.Upcoming]: { piIcon: 'pi pi-calendar' },
  [MyTab.PendingApproval]: { piIcon: 'pi pi-hourglass' },
  [MyTab.Waitlisted]: { piIcon: 'pi pi-clock' },
  [MyTab.Past]: { piIcon: 'pi pi-history' },
  [MyTab.Cancelled]: { piIcon: 'pi pi-times-circle' },
});

/** `active` reads "Upcoming" and `ended` reads "Past" on purpose — the enum
    names the template state, the label names what the coach is looking at. */
export const TEMPLATE_TABS: Record<TemplateTab, { label: string; piIcon: string }> = withEnumLabels(
  'templateTab',
  {
    [TemplateTab.Active]: { piIcon: 'pi pi-calendar' },
    [TemplateTab.Recurring]: { piIcon: 'pi pi-replay' },
    [TemplateTab.Ended]: { piIcon: 'pi pi-history' },
    [TemplateTab.Cancelled]: { piIcon: 'pi pi-times-circle' },
  },
);
