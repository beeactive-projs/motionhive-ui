import { MessageView } from '../models/messaging';

/**
 * Presentation helpers shared by every messaging surface — pure functions over
 * the BE contracts, no DOM, no framework.
 */

/**
 * Loose shape: anything with first/last name strings (or null). Both
 * `ParticipantSnapshot` (DM other-user) and `UserSearchResult`
 * (new-message picker rows) satisfy it — neither type is imported, so this
 * stays decoupled from the BE contracts.
 */
interface NamedLike {
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Display name for a named entity. Joins `firstName + ' ' + lastName`,
 * dropping empty/null parts. Falls back to the supplied default when the
 * snapshot is null or has no usable fields (e.g. soft-deleted user).
 */
export function displayName(
  snapshot: NamedLike | null | undefined,
  fallback = 'Unknown',
): string {
  if (!snapshot) return fallback;
  const full = [snapshot.firstName, snapshot.lastName]
    .filter((s): s is string => !!s)
    .join(' ')
    .trim();
  return full || fallback;
}

/**
 * Initials for the hex-avatar fallback (e.g. "AB" for "Ana Bell").
 * Returns "?" when no initial can be derived.
 */
export function initialsOf(snapshot: NamedLike | null | undefined): string {
  if (!snapshot) return '?';
  const f = (snapshot.firstName ?? '').charAt(0);
  const l = (snapshot.lastName ?? '').charAt(0);
  return (f + l).toUpperCase() || '?';
}

// ─── Bubble grouping ──────────────────────────────────────────────

/** Position of a bubble within a run of consecutive same-author messages. */
export type BubblePosition = 'first' | 'middle' | 'last' | 'only';

export interface RenderedBubble {
  message: MessageView;
  position: BubblePosition;
  /** True when this is the first bubble of the day — caller emits a day divider before it. */
  startsNewDay: boolean;
  /** ISO of the day (yyyy-mm-dd) used as the divider key. */
  dayKey: string;
}

/**
 * Maximum gap between two messages from the same author for them to stay in
 * the same visual group. 5 minutes matches the design's grouping rule.
 */
const GROUPING_GAP_MS = 5 * 60 * 1000;

/**
 * Walk an ordered (oldest-first) list of messages and classify each one as
 * first/middle/last/only of a run, plus flag day boundaries.
 */
export function groupMessages(messages: MessageView[]): RenderedBubble[] {
  const out: RenderedBubble[] = [];
  let prevDay = '';

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prev = i > 0 ? messages[i - 1] : null;
    const next = i < messages.length - 1 ? messages[i + 1] : null;

    const dayKey = isoDay(msg.createdAt);
    const startsNewDay = dayKey !== prevDay;
    prevDay = dayKey;

    // A new day always restarts a run (visually nicer — no bubble group
    // spanning a "Today" / "Yesterday" divider).
    const continuesPrev =
      !startsNewDay &&
      prev !== null &&
      prev.senderId === msg.senderId &&
      prev.kind === msg.kind &&
      gapMs(prev, msg) <= GROUPING_GAP_MS;

    const continuesNext =
      next !== null &&
      isoDay(next.createdAt) === dayKey &&
      next.senderId === msg.senderId &&
      next.kind === msg.kind &&
      gapMs(msg, next) <= GROUPING_GAP_MS;

    let position: BubblePosition;
    if (!continuesPrev && !continuesNext) position = 'only';
    else if (!continuesPrev && continuesNext) position = 'first';
    else if (continuesPrev && continuesNext) position = 'middle';
    else position = 'last';

    out.push({ message: msg, position, startsNewDay, dayKey });
  }

  return out;
}

/**
 * Local calendar day as yyyy-mm-dd. Not `iso.slice(0, 10)` — that is the UTC
 * day, and west of Greenwich an evening message keys to tomorrow, which then
 * renders a "Today" divider mid-evening.
 */
function isoDay(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function gapMs(a: MessageView, b: MessageView): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/**
 * Human label for a day divider: "Today", "Yesterday", or the weekday + month
 * + day for older.
 */
export function dayDividerLabel(dayKey: string): string {
  const today = isoDay(new Date().toISOString());
  if (dayKey === today) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === isoDay(yesterday.toISOString())) return 'Yesterday';

  // Parsed as local midnight; `new Date('2026-08-10')` would be UTC midnight
  // and print the day before west of Greenwich.
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Inbox timestamps ─────────────────────────────────────────────

/**
 * Compact "now / 5m / 2h / yesterday / Mon / Apr 28" formatter for the inbox
 * row timestamp.
 *
 * Sub-minute gaps and small backwards clock skew both render as "now".
 * "yesterday" is the browser's local day, not the server's UTC boundary.
 */
export function formatRelativeShort(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const ms = Date.now() - then;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  // Local-day comparison: "yesterday" is whatever the user calls yesterday,
  // not whatever the server's UTC midnight thinks.
  const now = new Date();
  const that = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 3600_000;
  if (that.getTime() >= startOfYesterday && that.getTime() < startOfToday) {
    return 'yesterday';
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return that.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return that.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
