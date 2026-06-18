/**
 * Session domain models — mirror the backend DTOs and entity shapes.
 *
 * Two-table model: a SessionTemplate (the "class concept") spawns N
 * SessionInstance rows (one per occurrence). Participants book instances,
 * not templates. See `SESSIONS_MASTER_BUILD_PLAN.md` §1 (BE) for the full
 * shape rationale.
 */

import type {
  CancelScope,
  FollowUpAudience,
  MyTab,
  SessionAccess,
  SessionInstanceStatus,
  SessionLocationKind,
  SessionMeetingProvider,
  SessionParticipantStatus,
  SessionTemplateStatus,
  SessionType,
  TemplateTab,
} from './session.enums';

// ─── Reference types ──────────────────────────────────────────────────────

/** Compact instructor reference used in eager-loaded responses. */
export interface SessionInstructorRef {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  handle: string | null;
}

/** Compact venue reference used in eager-loaded responses. */
export interface SessionVenueRef {
  id: string;
  name: string;
  city: string | null;
  kind: string; // VenueKind from venue module — kept loose to avoid a cross-module import.
}

/** Compact group reference used in eager-loaded responses. */
export interface SessionGroupRef {
  id: string;
  name: string;
  slug: string;
}

// ─── Recurrence ───────────────────────────────────────────────────────────

export interface RecurrenceRule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  /** ISO 8601: 1 = Monday … 7 = Sunday. Required for WEEKLY only. */
  daysOfWeek?: number[];
  /** ISO date — exclusive with endAfterOccurrences. */
  endDate?: string;
  /** Exclusive with endDate. */
  endAfterOccurrences?: number;
}

// ─── Template (the "class concept") ───────────────────────────────────────

export interface SessionTemplate {
  id: string;
  instructorId: string;
  groupId: string | null;
  venueId: string | null;
  slug: string;
  title: string;
  description: string | null;
  type: SessionType;
  access: SessionAccess;
  approvalRequired: boolean;
  locationKind: SessionLocationKind;
  meetingUrl: string | null;
  meetingProvider: SessionMeetingProvider | null;
  durationMinutes: number;
  /** IANA timezone, e.g. 'Europe/Bucharest'. */
  timezone: string;
  capacity: number | null;
  waitlistEnabled: boolean;
  cancellationCutoffHours: number;
  priceAmountCents: number;
  priceCurrency: string;
  isRecurring: boolean;
  recurrenceRule: RecurrenceRule | null;
  /** ISO 8601 datetime of the first occurrence. */
  firstStartAt: string;
  status: SessionTemplateStatus;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Eager-loaded refs (present when the BE includes them):
  instructor?: SessionInstructorRef;
  group?: SessionGroupRef | null;
  venue?: SessionVenueRef | null;
}

// ─── Instance (one occurrence) ────────────────────────────────────────────

export interface SessionInstance {
  id: string;
  templateId: string;
  instructorId: string;
  occurrenceIndex: number;
  /** ISO 8601 datetime. */
  startAt: string;
  /** ISO 8601 datetime. */
  endAt: string;
  // Per-occurrence overrides (null = inherit from template):
  titleOverride: string | null;
  descriptionOverride: string | null;
  venueIdOverride: string | null;
  meetingUrlOverride: string | null;
  capacityOverride: number | null;
  isOverride: boolean;
  status: SessionInstanceStatus;
  cancelReason: string | null;
  cancelledAt: string | null;
  // Denormalised counters (maintained server-side):
  confirmedCount: number;
  pendingApprovalCount: number;
  waitlistedCount: number;
  attendedCount: number | null;
  /** Other instance IDs that overlap this one for the same instructor. */
  conflictingInstanceIds: string[] | null;
  createdAt: string;
  updatedAt: string;
  // Eager-loaded refs (present when the BE includes them):
  template?: SessionTemplate;
  instructor?: SessionInstructorRef;
  venueOverride?: SessionVenueRef | null;
  /** Owner-only — undefined for non-owner / non-participant callers. */
  participants?: SessionParticipant[];
}

// ─── Public-facing variants (no PII / no meeting URL) ─────────────────────

/**
 * Shape returned by `GET /sessions/discover` items and
 * `GET /sessions/instances/:id/public` when caller is eligible.
 *
 * The BE strips `meetingUrl`, `meetingUrlOverride`, `conflictingInstanceIds`,
 * `cancelReason`, and `attendedCount` from public responses.
 */
export type PublicSessionInstance = Omit<
  SessionInstance,
  | 'meetingUrlOverride'
  | 'conflictingInstanceIds'
  | 'cancelReason'
  | 'attendedCount'
  | 'participants'
> & {
  // The eager-loaded template also has meetingUrl stripped publicly.
  template?: Omit<SessionTemplate, 'meetingUrl'>;
};

/**
 * Shape returned to GROUP_ONLY non-members of
 * `GET /sessions/instances/:id/public`. Renders the "join the group" CTA.
 */
export interface BlockedSessionInstance {
  id: string;
  templateId: string;
  instructorId: string;
  /** ISO 8601 datetime. */
  startAt: string;
  /** ISO 8601 datetime. */
  endAt: string;
  status: SessionInstanceStatus;
  template: {
    id: string;
    slug: string;
    title: string;
    type: SessionType;
    access: SessionAccess;
    durationMinutes: number;
    instructorId: string;
    groupId: string | null;
  };
  instructor: SessionInstructorRef | null;
  isBlocked: true;
}

/** Discriminator: `'isBlocked' in instance` narrows to `BlockedSessionInstance`. */
export function isBlockedInstance(
  instance: PublicSessionInstance | BlockedSessionInstance,
): instance is BlockedSessionInstance {
  return (instance as BlockedSessionInstance).isBlocked === true;
}

// ─── Participant ──────────────────────────────────────────────────────────

export interface SessionParticipant {
  id: string;
  instanceId: string;
  userId: string;
  status: SessionParticipantStatus;
  attended: boolean | null;
  checkedInAt: string | null;
  bookingNote: string | null;
  /** Owner-only — undefined for non-owner callers. */
  privateNote?: string | null;
  // Immutable snapshot at booking time:
  snapshotPriceCents: number;
  snapshotCurrency: string;
  snapshotCancelCutoffH: number;
  snapshotLocationText: string | null;
  snapshotMeetingUrl: string | null;
  bookedAt: string;
  approvedAt: string | null;
  declinedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  waitlistPosition: number | null;
  user?: SessionInstructorRef; // reusing the compact ref shape
  /**
   * Eager-loaded occurrence the booking belongs to. The `listMy` response
   * embeds the instance + its template (title, type, location, duration,
   * capacity) and the denormalized `confirmedCount`, so the My-sessions
   * row can render time/title/price/capacity without extra requests.
   */
  instance?: SessionInstance;
}

// ─── Service request / response shapes ───────────────────────────────────

export interface CreateTemplateRequest {
  title: string;
  description?: string;
  type: SessionType;
  access: SessionAccess;
  approvalRequired?: boolean;
  groupId?: string;
  locationKind: SessionLocationKind;
  meetingUrl?: string;
  venueId?: string;
  durationMinutes: number;
  timezone: string;
  capacity?: number;
  waitlistEnabled?: boolean;
  cancellationCutoffHours?: number;
  priceAmountCents?: number;
  priceCurrency?: string;
  isRecurring: boolean;
  recurrenceRule?: RecurrenceRule;
  firstStartAt: string;
  generateInitialInstances?: boolean;
  initialInstancesCount?: number;
}

export type UpdateTemplateRequest = Partial<CreateTemplateRequest>;

export interface PreviewRecurrenceRequest {
  rule: RecurrenceRule;
  firstStartAt: string;
  timezone: string;
  weeksHorizon?: number;
}

export interface PreviewRecurrenceResponse {
  occurrences: string[]; // ISO 8601 datetimes
  truncated: boolean;
}

export interface RegenerateRequest {
  count: number;
}

export interface CreateTemplateResponse {
  template: SessionTemplate;
  generatedInstances: SessionInstance[];
  warnings: SessionWarning[];
}

export interface RegenerateResponse {
  generatedInstances: SessionInstance[];
  warnings: SessionWarning[];
}

export interface SessionWarning {
  code: 'CONFLICT';
  instanceIds: string[];
}

export interface ListTemplatesQuery {
  tab?: TemplateTab;
  type?: SessionType;
  access?: SessionAccess;
  locationKind?: SessionLocationKind;
  groupId?: string;
  q?: string;
  sortBy?: 'firstStartAt' | 'createdAt' | 'title';
  sortDir?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export interface ListInstancesQuery {
  dateFrom?: string;
  dateTo?: string;
  instructorId?: string;
  templateId?: string;
  status?: SessionInstanceStatus;
  page?: number;
  limit?: number;
}

export interface ListParticipantsQuery {
  status?: SessionParticipantStatus;
  page?: number;
  limit?: number;
}

export interface DiscoverQuery {
  q?: string;
  type?: SessionType;
  locationKind?: SessionLocationKind;
  instructorId?: string;
  groupId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface MyQuery {
  tab?: MyTab;
  page?: number;
  limit?: number;
}

export interface BookRequest {
  bookingNote?: string;
}

export interface BookResponse {
  status: SessionParticipantStatus;
  participantId: string;
}

export interface CancelBookingRequest {
  reason?: string;
  message?: string;
}

export interface CancelBookingResponse {
  status: 'CANCELLED';
  cancellation: 'WITHIN_WINDOW' | 'OUTSIDE_WINDOW';
  promotedUserId: string | null;
}

export interface CancelInstanceRequest {
  scope: CancelScope;
  reason?: string;
  message?: string;
  rescheduleTo?: string; // ISO 8601 datetime
}

export interface CancelInstanceResponse {
  scope: CancelScope;
  cancelledInstanceIds: string[];
  notifiedUserIds: string[];
}

export interface RescheduleInstanceRequest {
  newStartAt: string;
  message?: string;
}

export interface RescheduleInstanceResponse {
  instanceId: string;
  oldStartAt: string;
  newStartAt: string;
  notifiedUserIds: string[];
  warnings: SessionWarning[];
}

export interface PatchInstanceRequest {
  titleOverride?: string | null;
  descriptionOverride?: string | null;
  venueIdOverride?: string | null;
  meetingUrlOverride?: string | null;
  capacityOverride?: number | null;
}

export interface DeclineParticipantRequest {
  reason?: string;
}

export interface PatchParticipantRequest {
  attended?: boolean | null;
  privateNote?: string | null;
}

export interface FollowUpRequest {
  audience: FollowUpAudience;
  userIds?: string[];
  message: string;
}

export interface FollowUpResponse {
  notifiedUserIds: string[];
}

export interface MyCounts {
  upcoming: number;
  pendingApproval: number;
  waitlisted: number;
  past: number;
  cancelled: number;
}

export interface JoinInfo {
  meetingUrl: string;
  joinActiveFrom: string; // ISO 8601 datetime
  joinActiveUntil: string; // ISO 8601 datetime
  instructorJoined: boolean;
}
