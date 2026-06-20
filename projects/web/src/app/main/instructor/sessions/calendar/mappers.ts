import type { SessionInstance } from 'core';
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
  const subtitle = isOnline
    ? labelForProvider(template?.meetingProvider ?? null)
    : venueName;

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
    color: colorForType(template?.type),
    ring: (instance.conflictingInstanceIds?.length ?? 0) > 0 ? 'conflict' : 'none',
    badges: badges.length > 0 ? badges : undefined,
    payload: instance, // smart wrapper uses this on (eventClick) to navigate
  };
}

function colorForType(type: string | undefined): string {
  switch (type) {
    case 'GROUP':
      return 'var(--p-primary-500)';
    case 'PRIVATE':
      // Navy is Tailwind-only (per theme.css); fall back to a stable hex.
      return '#1D4ED8';
    case 'OPEN':
      // Teal — design canvas uses #14B8A6.
      return 'var(--p-cyan-500, #14B8A6)';
    default:
      return 'var(--p-surface-500)';
  }
}

function labelForProvider(provider: string | null): string {
  switch (provider) {
    case 'ZOOM':
      return 'Zoom';
    case 'GOOGLE_MEET':
      return 'Google Meet';
    case 'TEAMS':
      return 'Teams';
    default:
      return 'Online';
  }
}
