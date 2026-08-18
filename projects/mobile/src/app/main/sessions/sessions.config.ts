import {
  RecurrenceRule,
  SessionAccess,
  SessionInstance,
  SessionKind,
  SessionLocationKind,
  SessionTone,
  endOfDay,
  localDayKey,
  sessionTone,
  startOfDay,
} from 'core';

import {
  addOutline,
  alertCircle,
  alertCircleOutline,
  arrowForwardCircleOutline,
  calendarOutline,
  checkmarkCircleOutline,
  chevronBack,
  chevronDown,
  chevronForward,
  closeCircleOutline,
  copyOutline,
  createOutline,
  ellipsisVertical,
  funnelOutline,
  globeOutline,
  heartOutline,
  hourglassOutline,
  locationOutline,
  notificationsOutline,
  peopleOutline,
  personOutline,
  pricetagOutline,
  repeatOutline,
  searchOutline,
  sendOutline,
  shareOutline,
  timeOutline,
  videocamOutline,
} from 'ionicons/icons';

/**
 * Every icon the sessions screens render. Each page calls
 * `addIcons(SESSION_ICONS)` once, so a name in a template can never reference
 * an icon nobody registered.
 */
export const SESSION_ICONS = {
  addOutline,
  alertCircle,
  alertCircleOutline,
  arrowForwardCircleOutline,
  calendarOutline,
  checkmarkCircleOutline,
  chevronBack,
  chevronDown,
  chevronForward,
  closeCircleOutline,
  copyOutline,
  createOutline,
  ellipsisVertical,
  funnelOutline,
  globeOutline,
  heartOutline,
  hourglassOutline,
  locationOutline,
  notificationsOutline,
  peopleOutline,
  personOutline,
  pricetagOutline,
  repeatOutline,
  searchOutline,
  sendOutline,
  shareOutline,
  timeOutline,
  videocamOutline,
};

/**
 * How far either side of today the agenda loads.
 *
 * The BE caps a calendar window at 180 days and `listInstances` at 100 rows, so
 * this is a compromise: wide enough that scrolling forward rarely runs dry,
 * narrow enough that a busy coach's fortnight fits in one page.
 */
export const AGENDA_DAYS_AHEAD = 30;

/** Type tiles on the create sheet, in the design's order. */
export const SESSION_TYPE_OPTIONS = [
  { value: 'GROUP', label: 'Group', icon: 'people-outline' },
  { value: 'PRIVATE', label: '1-on-1', icon: 'person-outline' },
  { value: 'OPEN', label: 'Open', icon: 'globe-outline' },
] as const;

/** Where the session happens. Drives which fields the form shows. */
export const LOCATION_KIND_OPTIONS = [
  { value: 'IN_PERSON', label: 'In-person', icon: 'location-outline' },
  { value: 'ONLINE', label: 'Online', icon: 'videocam-outline' },
] as const;

/**
 * Who can book — the same four access levels the web dialog offers, with its
 * sub-copy carried along so the sheet can explain the selected one.
 */
export const SESSION_ACCESS_OPTIONS: readonly {
  value: SessionAccess;
  label: string;
  sub: string;
  icon: string;
}[] = [
  { value: 'OPEN', label: 'Open', sub: 'Anyone with the link can book.', icon: 'globe-outline' },
  { value: 'FREE', label: 'Free', sub: 'Listed publicly with no price tag.', icon: 'heart-outline' },
  {
    value: 'CLIENTS_ONLY',
    label: 'Clients only',
    sub: 'Only your active clients can book.',
    icon: 'person-outline',
  },
  {
    value: 'GROUP_ONLY',
    label: 'Group members',
    sub: 'Only members of a specific group.',
    icon: 'people-outline',
  },
];

/**
 * The chip row under the week strip — the one narrowing worth reaching without
 * opening the filter sheet, since "am I at a venue or on a call?" changes what
 * the next hour looks like.
 *
 * `null` leads because the row doubles as its own reset: with three chips there
 * is nowhere to put a separate clear, and a filter you cannot see how to undo
 * is worse than one you cannot set.
 */
export const LOCATION_QUICK_FILTERS: readonly {
  value: SessionLocationKind | null;
  label: string;
}[] = [
  { value: null, label: 'All types' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'IN_PERSON', label: 'In-person' },
];

/**
 * Weekday circles on the recurrence editor. `value` is ISO 8601 — 1=Mon..7=Sun,
 * which is what `RecurrenceRuleDto.daysOfWeek` expects. Getting this wrong
 * shifts a whole series by a day.
 */
export const WEEKDAYS = [
  { value: 1, label: 'M', short: 'Mon' },
  { value: 2, label: 'T', short: 'Tue' },
  { value: 3, label: 'W', short: 'Wed' },
  { value: 4, label: 'T', short: 'Thu' },
  { value: 5, label: 'F', short: 'Fri' },
  { value: 6, label: 'S', short: 'Sat' },
  { value: 7, label: 'S', short: 'Sun' },
] as const;

/** The single-letter column headers, for anything laying out a week. */
export const WEEKDAY_LETTERS = WEEKDAYS.map((day) => day.label);

/**
 * "Mon", "Mon & Wed", "Mon, Wed & Fri" — ISO weekday numbers as prose.
 *
 * The recurrence editor and the detail screen describe the same rule, and
 * before this they each had their own list-joining: one always used "&", the
 * other used commas, so creating a series and then opening it showed two
 * different sentences for one thing.
 */
export function formatWeekdayList(days: readonly number[]): string {
  const names = [...days]
    .sort((a, b) => a - b)
    .map((value) => WEEKDAYS.find((day) => day.value === value)?.short)
    .filter((name) => name !== undefined);

  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** "Group" / "1-on-1" / "Open" — the type as the create sheet named it. */
export function sessionTypeLabel(type: SessionKind | null | undefined): string {
  return SESSION_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? 'Session';
}

/** How often it comes round: "Every Tue & Thu", "Every 2 weeks", "Every day". */
function frequencyPhrase(rule: RecurrenceRule): string {
  const every = rule.interval > 1 ? `Every ${rule.interval}` : 'Every';

  if (rule.frequency === 'DAILY') return rule.interval > 1 ? `${every} days` : 'Every day';
  if (rule.frequency === 'MONTHLY') {
    return rule.interval > 1 ? `${every} months` : 'Every month';
  }

  const days = formatWeekdayList(rule.daysOfWeek ?? []);
  if (!days) return rule.interval > 1 ? `${every} weeks` : 'Every week';
  return rule.interval > 1 ? `${every} weeks on ${days}` : `Every ${days}`;
}

/**
 * "Every Tue & Thu · 24 occurrences" — a whole recurrence rule as one line.
 *
 * The end is only stated when the rule carries one. A series with neither an
 * end date nor a count is not endless — the BE materialises a batch of rows and
 * tops them up later — so promising "forever" here would be the wrong claim.
 */
export function formatRecurrenceSummary(rule: RecurrenceRule | null | undefined): string {
  if (!rule) return '';

  const parts = [frequencyPhrase(rule)];

  if (rule.endAfterOccurrences) {
    parts.push(`${rule.endAfterOccurrences} occurrences`);
  } else if (rule.endDate) {
    const end = new Date(rule.endDate);
    if (!Number.isNaN(end.getTime())) {
      parts.push(
        `until ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
      );
    }
  }

  return parts.join(' · ');
}

/**
 * The verbs on a session row, in priority order, destructive last.
 *
 * Only what an endpoint can actually deliver. Two are synthesized rather than
 * called: Duplicate opens the create sheet pre-filled (there is no duplicate
 * endpoint), and Share hands out a link the client builds itself.
 *
 * "Share booking link", not the design's "Share public link": every session URL
 * in the web app sits behind the auth guard, so the only genuinely public
 * destination is the coach's profile. The label should not promise a door that
 * is locked.
 */
export const SessionActionIds = {
  Open: 'open',
  CheckIn: 'checkIn',
  Message: 'message',
  Edit: 'edit',
  Duplicate: 'duplicate',
  Share: 'share',
  Cancel: 'cancel',
} as const;

export type SessionActionId =
  (typeof SessionActionIds)[keyof typeof SessionActionIds];

/**
 * Glyph colour per verb, so a column of six rows is scannable rather than a
 * wall of one hue.
 *
 * Honey lands on `Open` alone. It is the sheet's primary action — the same
 * thing tapping the row does — and the brand rule reserves honey for exactly
 * that. The two verbs with a meaning of their own take it (attendance is
 * green, sending is sky), the plumbing verbs stay neutral, and destructive is
 * red. None of these encode a *state*, which is the line honey must not cross.
 */
export const SESSION_ACTIONS: readonly {
  id: SessionActionId;
  label: string;
  icon: string;
  /** Ionic palette name for the leading glyph. */
  color: string;
  destructive?: boolean;
}[] = [
  {
    id: SessionActionIds.Open,
    label: 'Open session',
    icon: 'arrow-forward-circle-outline',
    color: 'primary',
  },
  {
    id: SessionActionIds.CheckIn,
    label: 'Check in attendees',
    icon: 'checkmark-circle-outline',
    color: 'success',
  },
  {
    id: SessionActionIds.Message,
    label: 'Message all signups',
    icon: 'send-outline',
    color: 'info',
  },
  { id: SessionActionIds.Edit, label: 'Edit session', icon: 'create-outline', color: 'medium' },
  { id: SessionActionIds.Duplicate, label: 'Duplicate', icon: 'copy-outline', color: 'medium' },
  { id: SessionActionIds.Share, label: 'Share booking link', icon: 'share-outline', color: 'medium' },
  {
    id: SessionActionIds.Cancel,
    label: 'Cancel session…',
    icon: 'close-circle-outline',
    color: 'danger',
    destructive: true,
  },
];

/**
 * Which screen opened the verb sheet.
 *
 * The list is shared, but two of its verbs only make sense from a distance:
 * "Open session" and "Check in attendees" both mean "take me to the detail
 * screen", which is a dead end when you are already on it. The sheet drops
 * them rather than the detail screen swallowing the taps.
 */
export const SessionSurfaces = {
  Agenda: 'agenda',
  Detail: 'detail',
} as const;

export type SessionSurface = (typeof SessionSurfaces)[keyof typeof SessionSurfaces];

/**
 * When a series stops. `never` still generates a first batch of occurrences —
 * the BE materialises rows rather than expanding a rule on read, so "forever"
 * means "top it up later" (`regenerate`), not "infinite".
 */
export const RecurrenceEndModes = {
  Never: 'never',
  OnDate: 'onDate',
  After: 'after',
} as const;

export type RecurrenceEndMode =
  (typeof RecurrenceEndModes)[keyof typeof RecurrenceEndModes];

export const RECURRENCE_END_OPTIONS: readonly {
  value: RecurrenceEndMode;
  label: string;
}[] = [
  { value: RecurrenceEndModes.Never, label: 'Never' },
  { value: RecurrenceEndModes.OnDate, label: 'On date' },
  { value: RecurrenceEndModes.After, label: 'After N' },
];

/** How many occurrences to materialise when the rule has no count of its own. */
export const DEFAULT_GENERATED_OCCURRENCES = 12;

/**
 * Everything the create sheet needs to open as a copy of an existing session.
 *
 * A plain data shape with no Ionic in sight, so the mapping is unit-testable
 * and the sheet only has to seed signals from it.
 */
export interface SessionPrefill {
  title: string;
  description: string;
  type: SessionKind;
  access: SessionAccess;
  approvalRequired: boolean;
  groupId: string | null;
  locationKind: SessionLocationKind;
  /** Local wall-clock, the format `ion-datetime` binds to. */
  startAt: string;
  durationMinutes: number;
  capacity: number | null;
  waitlistEnabled: boolean;
  cancellationCutoffHours: number;
  priceAmount: number | null;
  priceCurrency: string;
  meetingUrl: string;
  venueId: string | null;
  isRecurring: boolean;
  daysOfWeek: number[];
  endAfterOccurrences: number;
}

/** Local wall-clock string for `ion-datetime`, which does not take an instant. */
function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/**
 * Seed a new session from an existing occurrence — what "Duplicate" means,
 * given the API has no duplicate endpoint.
 *
 * The start rolls forward in whole weeks when the source is already past. A
 * copy of last Monday's class has to land in the future or the API refuses it,
 * and the same weekday at the same time is the slot the coach is actually
 * copying — moving it to "now" would lose the thing worth duplicating.
 */
export function prefillFromInstance(
  instance: SessionInstance,
  now: number = Date.now(),
): SessionPrefill {
  const template = instance.template;

  const start = new Date(instance.startAt);
  while (start.getTime() <= now) {
    start.setDate(start.getDate() + 7);
  }

  const priceCents = template?.priceAmountCents ?? 0;
  const rule = template?.recurrenceRule ?? null;

  return {
    title: instance.titleOverride ?? template?.title ?? '',
    description: template?.description ?? '',
    type: template?.type ?? 'GROUP',
    access: template?.access ?? 'OPEN',
    approvalRequired: template?.approvalRequired ?? false,
    groupId: template?.groupId ?? null,
    locationKind: template?.locationKind ?? 'IN_PERSON',
    startAt: toLocalIso(start),
    durationMinutes: template?.durationMinutes ?? 60,
    capacity: instance.capacityOverride ?? template?.capacity ?? null,
    waitlistEnabled: template?.waitlistEnabled ?? true,
    cancellationCutoffHours: template?.cancellationCutoffHours ?? 24,
    priceAmount: priceCents > 0 ? priceCents / 100 : null,
    priceCurrency: template?.priceCurrency ?? 'RON',
    meetingUrl: instance.meetingUrlOverride ?? template?.meetingUrl ?? '',
    venueId: instance.venueIdOverride ?? template?.venueId ?? null,
    isRecurring: !!rule,
    daysOfWeek: rule?.daysOfWeek ? [...rule.daysOfWeek] : [],
    endAfterOccurrences: rule?.endAfterOccurrences ?? DEFAULT_GENERATED_OCCURRENCES,
  };
}

/**
 * Does a proposed slot overlap something already loaded?
 *
 * Advisory only — it can only see the window in memory, which is exactly why
 * the server's own post-create warning stays. Worth having anyway: catching the
 * clash before the session exists is cheaper than cancelling it afterwards.
 */
export function findOverlap(
  instances: readonly SessionInstance[],
  startAt: Date,
  durationMinutes: number,
): SessionInstance | null {
  const start = startAt.getTime();
  const end = start + durationMinutes * 60_000;
  if (!Number.isFinite(start)) return null;

  return (
    instances.find((instance) => {
      const otherStart = new Date(instance.startAt).getTime();
      const otherEnd = new Date(instance.endAt).getTime();
      return start < otherEnd && otherStart < end;
    }) ?? null
  );
}

/**
 * What a cancel applies to. Values match core's `CancelScope`; the copy is
 * filled in per-session, since the counts differ every time.
 */
export const CANCEL_SCOPE_OPTIONS = [
  { value: 'this', label: 'This occurrence only' },
  { value: 'thisAndFuture', label: 'This and all future' },
  { value: 'series', label: 'The entire series' },
] as const;

/**
 * Spine colour for an occurrence. Wraps core's `sessionTone`, which needs a
 * template — instances from a list can arrive without one.
 */
export function instanceTone(instance: SessionInstance): SessionTone {
  return instance.template ? sessionTone(instance.template, instance) : 'honey';
}

/**
 * Tone from what the session *is*, ignoring whether it clashes.
 *
 * The hour rail needs both facts at once — an overlapping pair still has to
 * read as "a 1-on-1 against a group class" while the clash is called out — so
 * there the fill carries the type and a ring carries the conflict. Everywhere
 * a row can only say one thing, `instanceTone` is right and the clash wins.
 *
 * Implemented by hiding the conflict from core's `sessionTone` rather than
 * restating its priority order, which would drift the moment that order moves.
 */
export function instanceBaseTone(instance: SessionInstance): SessionTone {
  if (!instance.template) return 'honey';
  return sessionTone(instance.template, { ...instance, conflictingInstanceIds: null });
}

/** Capacity as the coach reads it: "8/12", or "8 booked" when uncapped. */
export function instanceCapacityLabel(instance: SessionInstance): string {
  const capacity = instance.capacityOverride ?? instance.template?.capacity ?? null;
  const confirmed = instance.confirmedCount;
  return capacity === null ? `${confirmed} booked` : `${confirmed}/${capacity}`;
}

/** Where it happens — the meeting provider online, else the venue name. */
export function instancePlaceLabel(instance: SessionInstance): string {
  if (instance.template?.locationKind === 'ONLINE') {
    return instance.template.meetingProvider ?? 'Online';
  }
  return instance.venueOverride?.name ?? instance.template?.venue?.name ?? '';
}

/**
 * "8/12 · Herăstrău" — the sub-line under a session title.
 *
 * Shared by the agenda row and the rail block so the two views of the same
 * occurrence cannot describe it differently.
 */
export function instanceMeta(instance: SessionInstance): string {
  const place = instancePlaceLabel(instance);
  const parts = [instanceCapacityLabel(instance)];
  if (place) parts.push(place);
  return parts.join(' · ');
}

/**
 * What the dots on the month grid mean.
 *
 * Deliberately not the design's Group / 1-on-1 / Open / Conflict. The tones
 * come from core's `sessionTone`, which tests location *before* type and has no
 * tone of its own for Open — an Open session is honey, exactly like a Group
 * one, so a legend promising to tell them apart would be lying. This describes
 * the colours that actually appear. Changing `sessionTone` to match the design
 * instead is a web-wide decision, not a mobile one.
 */
export const MONTH_LEGEND: readonly { tone: SessionTone; label: string }[] = [
  { tone: 'honey', label: 'Group' },
  { tone: 'navy', label: '1-on-1' },
  { tone: 'teal', label: 'Online' },
  { tone: 'coral', label: 'Conflict' },
];

// ─── Filters ──────────────────────────────────────────────────────────────

/**
 * What needs your attention, rather than what state the row is in.
 *
 * All three are sub-filters of SCHEDULED — the only status `loadRange` ever
 * asks the API for — so none of them touch the store. `Scheduled` therefore
 * means "nothing wrong with it": no clash, nobody waiting on approval.
 */
export const AgendaStatuses = {
  Scheduled: 'scheduled',
  ApprovalNeeded: 'approvalNeeded',
  Conflict: 'conflict',
} as const;

export type AgendaStatus = (typeof AgendaStatuses)[keyof typeof AgendaStatuses];

export const STATUS_OPTIONS: readonly { value: AgendaStatus; label: string }[] = [
  { value: AgendaStatuses.Scheduled, label: 'Scheduled' },
  { value: AgendaStatuses.ApprovalNeeded, label: 'Approval needed' },
  { value: AgendaStatuses.Conflict, label: 'Conflict' },
];

/**
 * What the agenda is narrowed to. Everything unset means "show it all".
 *
 * The free-text query is deliberately NOT in here: it lives in the header, and
 * the sheet's trigger shows how many filters are set — a letter typed into
 * search should not make that badge climb.
 *
 * Dates are `localDayKey` strings rather than `Date`s. They round-trip through
 * an object compared for changes, they are what `ion-datetime` wants, and
 * `yyyy-mm-dd` compares correctly as a plain string, so range checks need no
 * parsing at all.
 */
export interface AgendaFilters {
  type: SessionKind | null;
  locationKind: SessionLocationKind | null;
  status: AgendaStatus | null;
  dateFrom: string | null;
  dateTo: string | null;
  groupId: string | null;
}

export const NO_FILTERS: AgendaFilters = {
  type: null,
  locationKind: null,
  status: null,
  dateFrom: null,
  dateTo: null,
  groupId: null,
};

/**
 * How many of these are actually narrowing anything — drives the chip count.
 *
 * A from/to pair counts once: a range is one idea, and "Filters · 3" for what
 * the user set as a single date range reads as a miscount.
 */
export function activeFilterCount(filters: AgendaFilters): number {
  let count = 0;
  if (filters.type) count++;
  if (filters.locationKind) count++;
  if (filters.status) count++;
  if (filters.dateFrom || filters.dateTo) count++;
  if (filters.groupId) count++;
  return count;
}

/** Does this occurrence survive `status`? Shared so page and sheet agree. */
export function matchesStatus(
  instance: SessionInstance,
  status: AgendaStatus,
): boolean {
  const clashes = (instance.conflictingInstanceIds?.length ?? 0) > 0;
  const pending = instance.pendingApprovalCount > 0;

  switch (status) {
    case AgendaStatuses.Conflict:
      return clashes;
    case AgendaStatuses.ApprovalNeeded:
      return pending;
    default:
      return !clashes && !pending;
  }
}

/**
 * The single predicate the agenda narrows by — one place, so the list, the
 * week-strip dots and the counts can never disagree about what is showing.
 */
export function matchesFilters(
  instance: SessionInstance,
  filters: AgendaFilters,
  query: string,
): boolean {
  const template = instance.template;

  if (filters.type && template?.type !== filters.type) return false;
  if (filters.locationKind && template?.locationKind !== filters.locationKind) {
    return false;
  }
  if (filters.status && !matchesStatus(instance, filters.status)) return false;
  if (filters.groupId && template?.groupId !== filters.groupId) return false;

  if (filters.dateFrom || filters.dateTo) {
    const day = localDayKey(new Date(instance.startAt));
    if (filters.dateFrom && day < filters.dateFrom) return false;
    if (filters.dateTo && day > filters.dateTo) return false;
  }

  const needle = query.trim().toLowerCase();
  if (needle) {
    const title = (instance.titleOverride ?? template?.title ?? '').toLowerCase();
    if (!title.includes(needle)) return false;
  }

  return true;
}

// ─── The loaded window ────────────────────────────────────────────────────

/**
 * The BE rejects a range wider than this outright — `MAX_WINDOW_DAYS` in
 * `session-instance.service.ts`, which throws "Date range too wide". Mirrored
 * rather than discovered: a 400 here empties the agenda into an error screen.
 */
export const MAX_RANGE_DAYS = 180;

export interface DayWindow {
  start: Date;
  end: Date;
}

/** The inverse of `localDayKey` — 'yyyy-mm-dd' back to a local midnight. */
export function dayFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Whole calendar days spanned, measured midnight-to-midnight.
 *
 * Deliberately not the raw millisecond difference: our end bound is the last
 * instant of its day, so a "180 day" window is really 180.9999 days and the
 * BE's `> 180` check would reject the very window we sized to fit.
 */
export function windowDays(window: DayWindow): number {
  return (
    (startOfDay(window.end).getTime() - startOfDay(window.start).getTime()) /
    86_400_000
  );
}

/**
 * Grow a window to whole calendar months.
 *
 * The store's range cache is keyed on both bounds and holds three entries, so
 * un-quantised windows evict each other constantly — nudging a date bound by a
 * day is a brand new key. Rounded to months, every edit inside one month is the
 * same request, and the three slots hold three months instead of three
 * near-identical days.
 */
export function quantiseToMonths(window: DayWindow): DayWindow {
  const start = new Date(window.start.getFullYear(), window.start.getMonth(), 1);
  const end = new Date(window.end.getFullYear(), window.end.getMonth() + 1, 0);
  return { start: startOfDay(start), end: endOfDay(end) };
}

function union(a: DayWindow, b: DayWindow): DayWindow {
  return {
    start: a.start < b.start ? a.start : b.start,
    end: a.end > b.end ? a.end : b.end,
  };
}

/**
 * Widen `anchor` with whatever else we would like loaded, but only while the
 * result still fits the API's cap.
 *
 * Widening-only was the previous rule and it was wrong: paging the month sheet
 * forward kept growing one window until it crossed 180 days and every further
 * request 400'd. What the user is looking at has to win, so anything that will
 * not fit is dropped rather than the request being broken.
 */
export function fitWindow(anchor: DayWindow, extras: readonly DayWindow[]): DayWindow {
  let result = quantiseToMonths(anchor);

  // Rounding out to whole months can itself overshoot — a 175-day range
  // touching seven months quantises to well over 180 — so the anchor gets the
  // same treatment as everything else, giving up the rounding first and the
  // far end only if it still will not fit.
  if (windowDays(result) > MAX_RANGE_DAYS) {
    result = { start: startOfDay(anchor.start), end: endOfDay(anchor.end) };
  }
  if (windowDays(result) > MAX_RANGE_DAYS) {
    const end = new Date(result.start);
    end.setDate(end.getDate() + MAX_RANGE_DAYS);
    result = { start: result.start, end: endOfDay(end) };
  }

  for (const extra of extras) {
    const candidate = union(result, quantiseToMonths(extra));
    if (windowDays(candidate) <= MAX_RANGE_DAYS) result = candidate;
  }

  return result;
}
