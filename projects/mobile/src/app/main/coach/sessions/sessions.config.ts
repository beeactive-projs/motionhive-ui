import {
  CANCEL_SCOPES,
  CancelScope,
  RecurrenceRule,
  SESSION_ACCESS_LEVELS,
  SESSION_LOCATION_KINDS,
  SESSION_TYPES,
  SessionAccess,
  SessionAccessMeta,
  SessionInstance,
  SessionInstanceStatus,
  SessionTemplate,
  SessionType,
  SessionLocationKind,
  SessionTone,
  WEB_APP_URL,
  appLocale,
  endOfDay,
  formatMinorUnits,
  localDayKey,
  meetingProviderLabel,
  normalizeUrl,
  sessionLifecycle,
  sessionTone,
  sessionTypeLabel,
  startOfDay,
  translate,
  weekdayNames,
  SessionParticipantStatus,
} from 'core';

import {
  addOutline,
  alertCircleOutline,
  calendarOutline,
  cashOutline,
  checkmarkCircleOutline,
  chevronBackOutline,
  chevronForwardCircleOutline,
  chevronForwardOutline,
  closeCircleOutline,
  copyOutline,
  createOutline,
  ellipsisVerticalOutline,
  globeOutline,
  heartOutline,
  hourglassOutline,
  locationOutline,
  notificationsOutline,
  optionsOutline,
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

import { SheetAction } from '../../../_shared/components/action-sheet/action-sheet.model';

/**
 * Every icon the sessions screens render. Each page calls
 * `addIcons(SESSION_ICONS)` once, so a name in a template can never reference
 * an icon nobody registered.
 */
export const SESSION_ICONS = {
  addOutline,
  alertCircleOutline,
  calendarOutline,
  cashOutline,
  checkmarkCircleOutline,
  chevronBackOutline,
  chevronForwardCircleOutline,
  chevronForwardOutline,
  closeCircleOutline,
  copyOutline,
  createOutline,
  ellipsisVerticalOutline,
  globeOutline,
  heartOutline,
  hourglassOutline,
  locationOutline,
  notificationsOutline,
  optionsOutline,
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

// Labels below are getters, not values: these constants are evaluated when the
// module loads, which can be before the language file has — reading on access
// keeps them translated wherever they are rendered.

/** Type tiles on the create sheet, in the design's order — words and icons
    from core's `SESSION_TYPES`, in its ionicons dialect. */
export const SESSION_TYPE_OPTIONS: readonly {
  readonly value: SessionType;
  readonly label: string;
  readonly icon: string;
}[] = [SessionType.Group, SessionType.Private, SessionType.Open].map((value) => ({
  value,
  get label() {
    return sessionTypeLabel(value);
  },
  icon: SESSION_TYPES[value].ionIcon,
}));

/** Where the session happens — words and icons from core; drives the form. */
export const LOCATION_KIND_OPTIONS: readonly {
  readonly value: SessionLocationKind;
  readonly label: string;
  readonly icon: string;
}[] = [SessionLocationKind.InPerson, SessionLocationKind.Online].map((value) => ({
  value,
  get label() {
    return SESSION_LOCATION_KINDS[value].label;
  },
  icon: SESSION_LOCATION_KINDS[value].ionIcon,
}));

/**
 * Who can book — core's `SESSION_ACCESS_LEVELS` in its ionicons dialect, with
 * the sub-copy carried along so the sheet can explain the selected one.
 */
export const SESSION_ACCESS_OPTIONS: readonly {
  readonly value: SessionAccess;
  readonly label: string;
  readonly sub: string;
  readonly icon: string;
}[] = [
  SessionAccess.Open,
  SessionAccess.Free,
  SessionAccess.ClientsOnly,
  SessionAccess.GroupOnly,
].map((value) => ({
  value,
  get label() {
    return SESSION_ACCESS_LEVELS[value].label;
  },
  get sub() {
    return SESSION_ACCESS_LEVELS[value].sub;
  },
  icon: SESSION_ACCESS_LEVELS[value].ionIcon,
}));

// ─── Access and price ─────────────────────────────────────────────────────

/** Free has no price: the form hides the field and sends none. */
export function accessTakesPrice(access: SessionAccess): boolean {
  return access !== SessionAccess.Free;
}

/**
 * A paid session ("Paid" is OPEN) without a price above zero. Clients only
 * and group members may leave it empty, which means free.
 */
export function priceMissing(access: SessionAccess, amount: number | null): boolean {
  if (access !== SessionAccess.Open) {
    return false;
  }
  if (amount === null) {
    return true;
  }
  return amount <= 0;
}

/**
 * The price in cents as it is saved, or null for none: always none when it
 * is free, else the field, where empty means free.
 */
export function priceCentsFor(access: SessionAccess, amount: number | null): number | null {
  if (!accessTakesPrice(access) || amount === null) {
    return null;
  }
  return Math.round(amount * 100);
}

/**
 * Who can book, as the coach's screens name it. An OPEN ("Paid") session
 * saved without a price, before the form asked for one, books for free, so
 * it reads as Free rather than "Paid" beside a free price.
 */
export function accessLevelFor(access: SessionAccess, priceCents: number | null | undefined): SessionAccessMeta {
  let cents = 0;
  if (typeof priceCents === 'number') {
    cents = priceCents;
  }
  if (access === SessionAccess.Open && cents <= 0) {
    return SESSION_ACCESS_LEVELS[SessionAccess.Free];
  }
  return SESSION_ACCESS_LEVELS[access];
}

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
  readonly value: SessionLocationKind | null;
  readonly label: string;
}[] = [
  {
    value: null,
    get label() {
      return translate('sessions.filters.allTypes');
    },
  },
  ...[SessionLocationKind.Online, SessionLocationKind.InPerson].map((value) => ({
    value,
    get label() {
      return SESSION_LOCATION_KINDS[value].label;
    },
  })),
];

/**
 * Weekday circles on the recurrence editor. `value` is ISO 8601 — 1=Mon..7=Sun,
 * which is what `RecurrenceRuleDto.daysOfWeek` expects. Getting this wrong
 * shifts a whole series by a day.
 *
 * The names come from the UI locale (`weekdayNames` is Monday-first, so index
 * `value - 1`), read on access rather than frozen when the module loads.
 */
export const WEEKDAYS: readonly {
  readonly value: number;
  /** Single letter — "M", "T". */
  readonly label: string;
  /** Short name — "Mon", "Tue". */
  readonly short: string;
}[] = [1, 2, 3, 4, 5, 6, 7].map((value) => ({
  value,
  get label() {
    return weekdayNames('narrow')[value - 1];
  },
  get short() {
    return weekdayNames('short')[value - 1];
  },
}));

/** The single-letter column headers, Monday first, for anything laying out a week. */
export function weekdayLetters(): string[] {
  return weekdayNames('narrow');
}

/**
 * "Mon", "Mon & Wed", "Mon, Wed & Fri" — ISO weekday numbers as prose.
 *
 * The recurrence editor and the detail screen describe the same rule, and
 * before this they each had their own list-joining: one always used "&", the
 * other used commas, so creating a series and then opening it showed two
 * different sentences for one thing.
 */
export function formatWeekdayList(days: readonly number[]): string {
  const short = weekdayNames('short');
  const names = [...days]
    .sort((a, b) => a - b)
    .filter((value) => value >= 1 && value <= 7)
    .map((value) => short[value - 1]);

  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return translate('sessions.recurrence.dayList', {
    list: names.slice(0, -1).join(', '),
    last: names[names.length - 1],
  });
}

/** How often it comes round: "Every Tue & Thu", "Every 2 weeks", "Every day". */
function frequencyPhrase(rule: RecurrenceRule): string {
  const count = Math.max(1, rule.interval);

  if (rule.frequency === 'DAILY') return translate('sessions.recurrence.everyDays', { count });
  if (rule.frequency === 'MONTHLY') {
    return translate('sessions.recurrence.everyMonths', { count });
  }

  const days = formatWeekdayList(rule.daysOfWeek ?? []);
  if (!days) return translate('sessions.recurrence.everyWeeks', { count });
  return translate('sessions.recurrence.everyWeeksOn', { count, days });
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

  const frequency = frequencyPhrase(rule);
  let end: string | null = null;

  if (rule.endAfterOccurrences) {
    end = translate('sessions.recurrence.occurrences', { count: rule.endAfterOccurrences });
  } else if (rule.endDate) {
    const endDate = new Date(rule.endDate);
    if (!Number.isNaN(endDate.getTime())) {
      end = translate('sessions.recurrence.until', {
        date: endDate.toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' }),
      });
    }
  }

  return end ? translate('sessions.recurrence.summary', { frequency, end }) : frequency;
}

/**
 * The verbs on a session row, in priority order, destructive last.
 *
 * Only what an endpoint can actually deliver. Two are synthesized rather than
 * called: Duplicate opens the create sheet pre-filled (there is no duplicate
 * endpoint), and Share hands out a link the client builds itself
 * (`sessionShareUrl`).
 */
export const SessionActionIds = {
  Open: 'open',
  CheckIn: 'checkIn',
  Message: 'message',
  Edit: 'edit',
  Reschedule: 'reschedule',
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
 * Honey lands on `Open`, the sheet's primary action (the same thing tapping
 * the row does), and on `Edit`, which only the detail screen shows, where
 * Open is not: one honey row per sheet. The rest take their concept's hue
 * (attendance green, sending and sharing sky, the copy teal, a new date
 * violet), and destructive is red. None of these encode a *state*, which is the line honey must not
 * cross.
 */
export const SESSION_ACTIONS: readonly SheetAction<SessionActionId>[] = [
  {
    id: SessionActionIds.Open,
    label: 'sessions.actions.open',
    icon: 'chevron-forward-circle-outline',
    color: 'primary',
  },
  {
    id: SessionActionIds.CheckIn,
    label: 'sessions.actions.checkIn',
    icon: 'checkmark-circle-outline',
    color: 'success',
  },
  {
    id: SessionActionIds.Message,
    label: 'sessions.actions.message',
    icon: 'send-outline',
    color: 'info',
  },
  {
    id: SessionActionIds.Edit,
    label: 'sessions.actions.edit',
    icon: 'create-outline',
    color: 'primary',
  },
  {
    id: SessionActionIds.Reschedule,
    label: 'sessions.actions.reschedule',
    icon: 'calendar-outline',
    color: 'violet',
  },
  {
    id: SessionActionIds.Duplicate,
    label: 'button.duplicate',
    icon: 'copy-outline',
    color: 'teal',
  },
  {
    id: SessionActionIds.Share,
    label: 'sessions.actions.share',
    icon: 'share-outline',
    color: 'info',
    tone: 'shade',
  },
  {
    id: SessionActionIds.Cancel,
    label: 'sessions.actions.cancel',
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
  /** Translation key — the form's template translates it. */
  label: string;
}[] = [
  { value: RecurrenceEndModes.Never, label: 'sessions.form.endMode.never' },
  { value: RecurrenceEndModes.OnDate, label: 'sessions.form.endMode.onDate' },
  { value: RecurrenceEndModes.After, label: 'sessions.form.endMode.after' },
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
  type: SessionType;
  access: SessionAccess;
  approvalRequired: boolean;
  groupId: string | null;
  locationKind: SessionLocationKind;
  /** Wall clock in `timezone`, the format `ion-datetime` binds to. */
  startAt: string;
  /** The source's own zone, so a copy repeats on the same clock. */
  timezone: string;
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
export function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** The phone's own zone, the form's default. */
export function deviceTimezone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (zone) {
    return zone;
  }
  return 'Europe/Bucharest';
}

// ─── Time zones ───────────────────────────────────────────────────────────

interface WallClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * The calendar date and clock time an instant shows in `timeZone`. Read back
 * as numbers, never displayed: Latin digits and a 0 to 23 hour are asked for,
 * so the parts parse the same in every language.
 */
function wallClockParts(instant: number, timeZone: string): WallClockParts {
  const format = new Intl.DateTimeFormat(appLocale(), {
    timeZone,
    numberingSystem: 'latn',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: WallClockParts = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
  for (const part of format.formatToParts(instant)) {
    if (part.type in parts) {
      parts[part.type as keyof WallClockParts] = Number(part.value);
    }
  }
  return parts;
}

/** How far `timeZone` is ahead of UTC at `instant`, in milliseconds. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = wallClockParts(instant, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/**
 * A wall clock as `ion-datetime` gives it (`2026-11-21T18:00`), read in
 * `timeZone`, as the UTC instant the API takes.
 *
 * `new Date(wallClock)` reads it in the phone's zone instead, so 18:00 picked
 * for Europe/London on a phone in Bucharest was stored as 16:00 in London. The
 * offset is measured twice because the first guess can land across a clock
 * change; a time the change skips (03:30 on the spring night) moves an hour
 * on, as the clocks do. An unknown zone falls back to the phone's.
 */
export function zonedWallClockToIso(wallClock: string, timeZone: string): string {
  const match = WALL_CLOCK.exec(wallClock);
  if (!match) {
    return new Date(wallClock).toISOString();
  }
  const guess = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  try {
    const first = guess - zoneOffsetMs(guess, timeZone);
    const instant = guess - zoneOffsetMs(first, timeZone);
    return new Date(instant).toISOString();
  } catch {
    return new Date(wallClock).toISOString();
  }
}

/** An instant as the wall clock `ion-datetime` binds to, in `timeZone`. */
export function wallClockInZone(instant: Date | string | number, timeZone: string): string {
  const date = new Date(instant);
  try {
    const parts = wallClockParts(date.getTime(), timeZone);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(
      parts.minute,
    )}`;
  } catch {
    return toLocalIso(date);
  }
}

/**
 * Seed a new session from an existing occurrence — what "Duplicate" means,
 * given the API has no duplicate endpoint.
 *
 * The start rolls forward in whole weeks when the source is already past. A
 * copy of last Monday's class has to land in the future or the API refuses it,
 * and the same weekday at the same time is the slot the coach is actually
 * copying — moving it to "now" would lose the thing worth duplicating.
 *
 * `fullTemplate` is the template read on its own, when the caller has it (the
 * detail page). The one nested on an instance is the API's short field list,
 * with no `recurrenceRule`, so a weekly series copied from it became a one-off.
 */
export function prefillFromInstance(
  instance: SessionInstance,
  now: number = Date.now(),
  fullTemplate: SessionTemplate | null = null,
): SessionPrefill {
  let template = instance.template;
  if (fullTemplate) {
    template = fullTemplate;
  }

  const start = new Date(instance.startAt);
  while (start.getTime() <= now) {
    start.setDate(start.getDate() + 7);
  }

  const priceCents = template?.priceAmountCents ?? 0;
  const rule = template?.recurrenceRule ?? null;
  let timezone = deviceTimezone();
  if (template?.timezone) {
    timezone = template.timezone;
  }

  return {
    title: instance.titleOverride ?? template?.title ?? '',
    description: template?.description ?? '',
    type: template?.type ?? 'GROUP',
    access: template?.access ?? 'OPEN',
    approvalRequired: template?.approvalRequired ?? false,
    groupId: template?.groupId ?? null,
    locationKind: template?.locationKind ?? 'IN_PERSON',
    startAt: wallClockInZone(start, timezone),
    timezone,
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

// ─── Form checks ──────────────────────────────────────────────────────────

/** The API's seat range (`@Min(1) @Max(1000)` on `capacity`). */
export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 1000;

/** Empty means no limit; anything else must be a whole number the API takes. */
export function isValidCapacity(capacity: number | null): boolean {
  if (capacity === null) {
    return true;
  }
  return Number.isInteger(capacity) && capacity >= MIN_CAPACITY && capacity <= MAX_CAPACITY;
}

/** The API's cap on a meeting link (`@MaxLength(500)`). */
const MAX_MEETING_LINK = 500;

/**
 * A meeting link as the API takes it, or null when it cannot be one.
 *
 * Forgiving of a pasted link without its scheme (`zoom.us/j/1` gets
 * `https://`), but https only: the API refuses `http:`, and refusing it here
 * says why in the field instead of in a generic error after Save.
 */
export function meetingLinkFor(input: string): string | null {
  const normalized = normalizeUrl(input);
  if (!normalized) {
    return null;
  }
  if (!normalized.startsWith('https://') || normalized.length > MAX_MEETING_LINK) {
    return null;
  }
  return normalized;
}

/** A series' last date (`yyyy-mm-dd`) set before its first session's day. */
export function endsBeforeStart(endDate: string | null, startWallClock: string): boolean {
  if (!endDate) {
    return false;
  }
  return endDate < startWallClock.slice(0, 10);
}

/** Whether an hour on `day` has already begun, so no new session is offered there. */
export function hourHasStarted(day: Date, hour: number, now: number): boolean {
  const slot = new Date(day);
  slot.setHours(hour, 0, 0, 0);
  return slot.getTime() < now;
}

/**
 * Whether one date can move to another time: the API moves only a SCHEDULED
 * occurrence, and one already under way or over has nothing left to move.
 * From the times as well as the status, which the API's cron moves late.
 */
export function canReschedule(instance: SessionInstance, now: number = Date.now()): boolean {
  if (instance.status !== SessionInstanceStatus.Scheduled) {
    return false;
  }
  return sessionLifecycle(instance.startAt, instance.endAt, now) === 'upcoming';
}

// ─── Where a day opens on the hour rail ───────────────────────────────────

/** A quiet day other than today opens on the working morning. */
export const DAY_OPEN_HOUR = 8;

/** How much of the hour before stays in view above where a day opens. */
export const DAY_OPEN_CONTEXT_HOURS = 0.5;

/**
 * The hour a day opens on, on the phone's clock, with minutes as a fraction
 * (17:30 is 17.5): its first session's start; with none, the hour it is now
 * when the day is today, else 08:00.
 */
export function dayOpenHour(
  instances: readonly SessionInstance[],
  day: Date,
  now: number,
): number {
  const key = localDayKey(day);
  let first: number | null = null;
  for (const instance of instances) {
    const start = new Date(instance.startAt);
    if (localDayKey(start) !== key) {
      continue;
    }
    if (first === null || start.getTime() < first) {
      first = start.getTime();
    }
  }

  if (first !== null) {
    const start = new Date(first);
    return start.getHours() + start.getMinutes() / 60;
  }
  const today = new Date(now);
  if (localDayKey(today) === key) {
    return today.getHours();
  }
  return DAY_OPEN_HOUR;
}

/**
 * How far down the rail the view starts, in pixels from its first hour: the
 * hour a day opens on, with a little of the one before it above. 0 when that
 * is already the top, so nothing is scrolled away for a few pixels.
 */
export function railScrollOffset(hour: number, firstHour: number, hourHeight: number): number {
  return Math.max(0, (hour - DAY_OPEN_CONTEXT_HOURS - firstHour) * hourHeight);
}

/**
 * "49.50 RON", "50 RON": cents only when there are some, as the trainee's
 * screens show a price (`formatMinorUnits`). Null when it is free.
 */
export function sessionPriceLabel(cents: number, currency: string): string | null {
  if (cents <= 0) {
    return null;
  }
  return `${formatMinorUnits(cents, { trimWholeNumbers: true })} ${currency.toUpperCase()}`;
}

/**
 * The link Share hands out: the session on the web app. The app claims this
 * path (the iOS apple-app-site-association and the Android App Links), so on
 * a phone it opens the session in the app, and in a browser it opens the
 * session after signing in.
 */
export function sessionShareUrl(instanceId: string): string {
  return `${WEB_APP_URL}/sessions/${instanceId}`;
}

/**
 * What a cancel applies to. Values are core's `CancelScope` members; the copy
 * is filled in per-session, since the details differ every time.
 */
export const CANCEL_SCOPE_OPTIONS: readonly {
  readonly value: CancelScope;
  readonly label: string;
}[] = [CancelScope.This, CancelScope.ThisAndFuture, CancelScope.Series].map((value) => ({
  value,
  get label() {
    return CANCEL_SCOPES[value].label;
  },
}));

/**
 * Spine colour for an occurrence. Wraps core's `sessionTone`, which needs a
 * template — instances from a list can arrive without one.
 */
export function instanceTone(instance: SessionInstance): SessionTone {
  return instance.template ? sessionTone(instance.template, instance) : 'honey';
}

/**
 * Spine colour for an agenda row: a session that has ended reads as the
 * record (`muted`, the spine vocabulary's "done"), whatever it was; until then
 * `instanceTone`. From the times rather than `status`, which the API's cron
 * moves a few minutes late.
 */
export function rowTone(instance: SessionInstance, now: number = Date.now()): SessionTone {
  if (sessionLifecycle(instance.startAt, instance.endAt, now) === 'past') {
    return 'muted';
  }
  return instanceTone(instance);
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
  return capacity === null
    ? translate('sessions.booked', { count: confirmed })
    : `${confirmed}/${capacity}`;
}

/** Where it happens — the meeting provider online, else the venue name. */
export function instancePlaceLabel(instance: SessionInstance): string {
  if (instance.template?.locationKind === SessionLocationKind.Online) {
    return meetingProviderLabel(instance.template.meetingProvider);
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
 * What the dots on the month grid mean — the design's legend, which
 * `sessionTone` now honours: since it colours by type from core's
 * `SESSION_TYPES` (location no longer plays), every promise here is one the
 * dots actually keep.
 */
export const MONTH_LEGEND: readonly { readonly tone: SessionTone; readonly label: string }[] = [
  {
    tone: 'honey',
    get label() {
      return sessionTypeLabel(SessionType.Group);
    },
  },
  {
    tone: 'navy',
    get label() {
      return sessionTypeLabel(SessionType.Private);
    },
  },
  {
    tone: 'teal',
    get label() {
      return sessionTypeLabel(SessionType.Open);
    },
  },
  {
    tone: 'coral',
    get label() {
      return translate('sessions.status.conflict');
    },
  },
];

// ─── Filters ──────────────────────────────────────────────────────────────

/**
 * What needs your attention, rather than what state the row is in.
 *
 * All three narrow what `loadRange` already holds (every occurrence but the
 * cancelled ones), so none of them touch the store. `Scheduled` therefore
 * means "nothing wrong with it": no clash, nobody waiting on approval.
 */
export const AgendaStatuses = {
  Scheduled: 'scheduled',
  ApprovalNeeded: 'approvalNeeded',
  Conflict: 'conflict',
} as const;

export type AgendaStatus = (typeof AgendaStatuses)[keyof typeof AgendaStatuses];

export const STATUS_OPTIONS: readonly {
  value: AgendaStatus;
  /** Translation key — the filter sheet's template translates it. */
  label: string;
}[] = [
  { value: AgendaStatuses.Scheduled, label: 'sessions.status.scheduled' },
  { value: AgendaStatuses.ApprovalNeeded, label: 'sessions.status.approvalNeeded' },
  { value: AgendaStatuses.Conflict, label: 'sessions.status.conflict' },
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
  type: SessionType | null;
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

/**
 * The number on the strip's Filters chip. A place alone is what the
 * location chips beside it say, so it counts only once the sheet holds more
 * (a type, a status, dates, a group, or a place no chip offers): one thing
 * is on at a time.
 */
export function sheetChipCount(filters: AgendaFilters): number {
  const chipSaysIt = LOCATION_QUICK_FILTERS.some((chip) => chip.value === filters.locationKind);
  const beyond = !chipSaysIt || activeFilterCount({ ...filters, locationKind: null }) > 0;
  return beyond ? activeFilterCount(filters) : 0;
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

/**
 * The agenda list: what is on from `today`, today's finished sessions
 * included, since the loaded window opens on the first of the month. The past
 * stays on the day view and the month, and shows in the list once a date
 * filter asks for it.
 */
export function agendaRows(
  instances: readonly SessionInstance[],
  filters: AgendaFilters,
  today: Date,
): SessionInstance[] {
  if (filters.dateFrom) {
    return [...instances];
  }
  const from = startOfDay(today).getTime();
  return instances.filter((instance) => new Date(instance.startAt).getTime() >= from);
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
 * Widening-only was the previous rule and it was wrong: paging the month card
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

/**
 * On a session's roster: the people with a place and the requests waiting
 * on one. The waitlist has its own section; a cancelled or declined booking
 * has no place, so it is neither listed nor counted for attendance.
 */
export function onTheRoster(participant: { status: string }): boolean {
  return (
    participant.status === SessionParticipantStatus.Confirmed ||
    participant.status === SessionParticipantStatus.PendingApproval
  );
}
