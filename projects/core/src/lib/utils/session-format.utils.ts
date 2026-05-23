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
