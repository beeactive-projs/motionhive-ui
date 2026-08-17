import type { SessionInstance, SessionTemplate } from '../models/session/session.model';

/**
 * Pure formatting helpers for session-shaped data. Live here so every
 * surface that renders sessions (instructor list, calendar agenda,
 * detail page, discover, my-sessions) can share the same formatting
 * without copy-pasting.
 *
 * Locale is fixed to `en-GB` for now — matches the rest of the app's
 * date formatting (24h time, day-first dates). If we ever ship a
 * locale switcher, swap the literal for an injected token.
 */

/** "09:00" — 24h local time from an ISO date string. */
export function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** "60min" — short duration label for time-row chips. */
export function formatSessionDuration(minutes: number): string {
  return `${minutes}min`;
}

/**
 * How long one occurrence runs, in minutes.
 *
 * Measured from the instants, not `template.durationMinutes`: a list endpoint
 * can return instances without their template (the same reason `sessionTone`
 * takes a nullable one), and `endAt` is always present. The template is only
 * the fallback for a malformed pair.
 */
export function sessionMinutes(instance: SessionInstance): number {
  const span =
    (new Date(instance.endAt).getTime() - new Date(instance.startAt).getTime()) /
    60_000;
  if (Number.isFinite(span) && span > 0) return Math.round(span);
  return instance.template?.durationMinutes ?? 0;
}

/**
 * "6h" / "6h 30m" / "45m" — a summed workload, e.g. "5 sessions · 6h scheduled".
 *
 * Deliberately not `formatSessionDuration`, which renders a single session's
 * length as "60min" for a row chip. Totals read in hours; rows read in minutes.
 */
export function formatTotalDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

/**
 * Lifecycle of a single occurrence relative to *now*, computed from its
 * start and end instants:
 *
 *   upcoming — hasn't started yet            (now < start)
 *   ongoing  — started but not yet finished  (start ≤ now < end)
 *   past     — fully finished                (now ≥ end)
 *
 * The "ongoing" bucket is the one easy to miss: a session whose start is in
 * the past is NOT necessarily over — `startAt + duration` (i.e. `endAt`) may
 * still be ahead of now. Callers that only checked `start < now` would wrongly
 * mute / un-join such a row. Always reason about lifecycle, not just start.
 *
 * `now` is injectable for testing; defaults to the current clock.
 */
export type SessionLifecycle = 'upcoming' | 'ongoing' | 'past';
export function sessionLifecycle(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  now: number = Date.now(),
): SessionLifecycle {
  const start = startIso ? new Date(startIso).getTime() : NaN;
  if (!Number.isNaN(start) && now < start) return 'upcoming';
  const end = endIso ? new Date(endIso).getTime() : NaN;
  if (!Number.isNaN(end) && now >= end) return 'past';
  // Unknown start → nothing to attend yet; otherwise it's started and not ended.
  return Number.isNaN(start) ? 'upcoming' : 'ongoing';
}

/**
 * "in 18 min" — how long until an occurrence starts, or `null` when there is
 * nothing useful to say.
 *
 * The forward-looking counterpart to `formatRelativeShort`, which only reads
 * backwards and collapses every future instant to "now". Returns `null` in
 * three cases, all meaning "don't render a countdown": the session has already
 * started (ask `sessionLifecycle` instead — "live now" is a different label),
 * the timestamp is unusable, or it is more than eight hours out, where a
 * countdown is noise next to the date already on the row.
 *
 * Resolution is deliberately coarse — minutes only inside the last hour. That
 * is what lets callers hold a clock they refresh on view-enter/resume rather
 * than running a timer: past the hour mark, a stale value still reads correctly.
 *
 * `now` is injectable for testing; defaults to the current clock.
 */
export function formatTimeUntil(
  startIso: string | null | undefined,
  now: number = Date.now(),
): string | null {
  const start = startIso ? new Date(startIso).getTime() : NaN;
  if (Number.isNaN(start)) return null;

  const diff = start - now;
  if (diff <= 0) return null;
  if (diff < 60_000) return 'starting now';

  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `in ${minutes} min`;

  const hours = Math.round(diff / 3_600_000);
  return hours <= 8 ? `in ${hours} h` : null;
}

/** "Wed 25 Jun" — compact weekday + day + short month, en-GB. */
export function formatSessionDayShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Tone for a `<mh-time-row>` given a template + (optional) instance.
 * Picks the design's coral / muted / teal / navy / honey accent.
 *
 * Priority order matters: conflict > cancelled > online > 1-on-1 >
 * default. A 1-on-1 online session keeps the teal (location wins)
 * because that's the user's primary signal — "do I need a meeting
 * link?" — over "is this a 1-on-1?".
 */
export type SessionTone = 'honey' | 'teal' | 'navy' | 'coral' | 'muted';
export function sessionTone(
  t: SessionTemplate,
  inst: SessionInstance | null,
): SessionTone {
  if (inst?.conflictingInstanceIds?.length) return 'coral';
  if (inst?.status === 'CANCELLED') return 'muted';
  if (t.locationKind === 'ONLINE') return 'teal';
  if (t.type === 'PRIVATE') return 'navy';
  return 'honey';
}

/** Day-separator accent — 'today' for the current day, else 'default'. */
export function dayTone(date: Date): 'today' | 'default' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime() ? 'today' : 'default';
}

/**
 * Day separator label like "Today · Thu 21 May", "Tomorrow · Fri 22 May",
 * or "Mon 25 May". Used by the agenda list separator and (eventually)
 * the calendar agenda view.
 */
export function sessionDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const long = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  if (diffDays === 0) return `Today · ${long}`;
  if (diffDays === 1) return `Tomorrow · ${long}`;
  return long;
}

// ─── Relative bucketing (Today / Tomorrow / This week / by month) ──────────
//
// Coarser grouping than the per-day separator above. Used by the Discover +
// My-sessions lists, which can stretch months ahead/behind: near-term days
// stay as their own bucket, everything else collapses to one section/month.

/** Which way the list reads: upcoming (asc) or historical (desc). */
export type SessionGroupDirection = 'future' | 'past';

export interface SessionBucket {
  /** Stable grouping key — 'today' | 'tomorrow' | 'yesterday' | 'this-week' | 'YYYY-MM'. */
  key: string;
  /** Header label — 'Today' | 'Tomorrow' | 'This week' | 'Earlier this week' | 'July 2026'. */
  label: string;
  /** False for single-day buckets (today/tomorrow/yesterday) — rows then hide their date. */
  multiDay: boolean;
}

/** Midnight copy of a date (mutation-free) so day maths ignores the clock time. */
function _startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ISO weekday, 1 = Monday … 7 = Sunday. */
function _isoDay(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function _monthBucket(date: Date): SessionBucket {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return {
    key: `${y}-${m}`,
    label: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    multiDay: true,
  };
}

/**
 * Bucket a single date relative to today, in the given direction.
 *
 *   future: Today · Tomorrow · This week (through Sun) · then by month
 *   past:   Today · Yesterday · Earlier this week (back to Mon) · then by month
 */
export function sessionBucket(date: Date, direction: SessionGroupDirection = 'future'): SessionBucket {
  const today = _startOfDay(new Date());
  const d = _startOfDay(date);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000);

  if (direction === 'future') {
    if (diffDays <= 0) return { key: 'today', label: 'Today', multiDay: false };
    if (diffDays === 1) return { key: 'tomorrow', label: 'Tomorrow', multiDay: false };
    const endOfWeekOffset = 7 - _isoDay(today); // days from today to Sunday
    if (diffDays <= endOfWeekOffset) {
      return { key: 'this-week', label: 'This week', multiDay: true };
    }
    return _monthBucket(d);
  }

  // past
  if (diffDays >= 0) return { key: 'today', label: 'Today', multiDay: false };
  if (diffDays === -1) return { key: 'yesterday', label: 'Yesterday', multiDay: false };
  const startOfWeekOffset = _isoDay(today) - 1; // days from Monday to today
  if (diffDays >= -startOfWeekOffset) {
    return { key: 'this-week', label: 'Earlier this week', multiDay: true };
  }
  return _monthBucket(d);
}

export interface SessionGroup<T> {
  bucket: SessionBucket;
  /** Representative day (earliest for future, latest for past) — drives tone + ordering. */
  date: Date;
  items: T[];
}

/**
 * Group items into relative buckets (see `sessionBucket`). Groups are ordered
 * by their representative day — ascending for `future`, descending for `past`
 * — and items within each group are sorted the same way.
 */
export function groupSessionsByBucket<T>(
  items: T[],
  getStart: (item: T) => string | null,
  direction: SessionGroupDirection = 'future',
): SessionGroup<T>[] {
  const desc = direction === 'past';
  const groups = new Map<string, SessionGroup<T>>();

  for (const item of items) {
    const start = getStart(item);
    const d = start ? new Date(start) : new Date(0);
    const bucket = sessionBucket(d, direction);
    const day = _startOfDay(d);
    const existing = groups.get(bucket.key);
    if (!existing) {
      groups.set(bucket.key, { bucket, date: day, items: [item] });
    } else {
      existing.items.push(item);
      // Keep the representative day = earliest (future) / latest (past).
      if (desc ? day.getTime() > existing.date.getTime() : day.getTime() < existing.date.getTime()) {
        existing.date = day;
      }
    }
  }

  const arr = Array.from(groups.values()).sort((a, b) =>
    desc ? b.date.getTime() - a.date.getTime() : a.date.getTime() - b.date.getTime(),
  );
  const ms = (item: T) => new Date(getStart(item) ?? 0).getTime();
  for (const g of arr) {
    g.items.sort((a, b) => (desc ? ms(b) - ms(a) : ms(a) - ms(b)));
  }
  return arr;
}
