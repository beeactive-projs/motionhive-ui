import { meetingProviderLabel, sessionTypeTone } from 'core';
import type { SessionInstance, SessionType, SessionTypeTone } from 'core';
import type { CalendarEvent } from '../../../../_shared/components/calendar/calendar-event.model';

/**
 * Map a `SessionInstance` (domain entity) → `CalendarEvent` (generic
 * grid shape).
 *
 * **Pure function** — no Angular injector, no store, no HTTP. Lives
 * here in the smart-wrapper layer because it's the ONE place where the
 * calendar engine and the session domain meet.
 *
 * Color convention matches the design canvas:
 *   - GROUP   → honey primary
 *   - PRIVATE → navy
 *   - OPEN    → teal
 *
 * The grid renders the tinted background + colored left border. We
 * pass the CSS variable name so the engine stays theme-aware (dark
 * mode tomorrow will swap the variable, not the event).
 */
export function instanceToCalendarEvent(
  instance: SessionInstance,
): CalendarEvent {
  const template = instance.template;
  const isOnline = template?.locationKind === 'ONLINE';
  const venueName =
    instance.venueOverride?.name ?? template?.venue?.name ?? 'In-person';
  const subtitle = isOnline ? meetingProviderLabel(template?.meetingProvider) : venueName;

  const badges: CalendarEvent['badges'] = [];
  if (isOnline) badges.push('online');
  if (template?.isRecurring) badges.push('recurring');
  if (instance.status === 'CANCELLED') badges.push('cancelled');

  return {
    id: instance.id,
    start: new Date(instance.startAt),
    end: new Date(instance.endAt),
    title: instance.titleOverride ?? template?.title ?? '(untitled)',
    subtitle,
    color: template?.type ? sessionTypeCssColor(template.type) : 'var(--p-surface-500)',
    ring: (instance.conflictingInstanceIds?.length ?? 0) > 0 ? 'conflict' : 'none',
    badges: badges.length > 0 ? badges : undefined,
    payload: instance, // smart wrapper uses this on (eventClick) to navigate
  };
}

/**
 * Core's abstract type tone as web paint. Honey rides the PrimeNG primary
 * token; navy is Tailwind-only (per theme.css) so it falls back to a stable
 * hex; teal is the design canvas's #14B8A6.
 */
const TONE_CSS: Record<SessionTypeTone, string> = {
  honey: 'var(--p-primary-500)',
  navy: '#1D4ED8',
  teal: 'var(--p-cyan-500, #14B8A6)',
};

/** CSS colour for a session type — shared by event blocks and the filter dots. */
export function sessionTypeCssColor(type: SessionType): string {
  return TONE_CSS[sessionTypeTone(type)];
}
