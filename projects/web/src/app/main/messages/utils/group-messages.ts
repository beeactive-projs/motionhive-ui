import { MessageView } from 'core';

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
 * Maximum gap between two messages from the same author for them to
 * stay in the same visual group. 5 minutes matches the design's
 * grouping rule.
 */
const GROUPING_GAP_MS = 5 * 60 * 1000;

/**
 * Walk an ordered (oldest-first) list of messages and classify each
 * one as first/middle/last/only of a run, plus flag day boundaries.
 *
 * Pure function — easy to unit test in F7 polish. Runs on every change
 * detection cycle for the active thread; with v1 limits (50 messages
 * per page, ≤ a few pages in cache at once) this is comfortably under
 * 1ms even for a 500-message thread.
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

    // A new day always restarts a run (visually nicer — no bubble
    // group spanning a "Today" / "Yesterday" divider).
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

function isoDay(iso: string): string {
  return iso.slice(0, 10); // yyyy-mm-dd
}

function gapMs(a: MessageView, b: MessageView): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/**
 * Human label for a day divider: "Today", "Yesterday", or the
 * weekday + month + day for older.
 */
export function dayDividerLabel(dayKey: string): string {
  const today = isoDay(new Date().toISOString());
  if (dayKey === today) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === isoDay(yesterday.toISOString())) return 'Yesterday';

  const date = new Date(dayKey);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
