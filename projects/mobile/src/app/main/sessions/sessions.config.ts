import { SessionInstance, SessionTone, sessionTone } from 'core';

import {
  addOutline,
  alertCircleOutline,
  calendarOutline,
  chevronBack,
  chevronForward,
  ellipsisHorizontal,
  globeOutline,
  locationOutline,
  peopleOutline,
  personOutline,
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
  alertCircleOutline,
  calendarOutline,
  chevronBack,
  chevronForward,
  ellipsisHorizontal,
  globeOutline,
  locationOutline,
  peopleOutline,
  personOutline,
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
 * Weekday circles on the recurrence editor. `value` is ISO 8601 — 1=Mon..7=Sun,
 * which is what `RecurrenceRuleDto.daysOfWeek` expects. Getting this wrong
 * shifts a whole series by a day.
 */
export const WEEKDAYS = [
  { value: 1, label: 'M' },
  { value: 2, label: 'T' },
  { value: 3, label: 'W' },
  { value: 4, label: 'T' },
  { value: 5, label: 'F' },
  { value: 6, label: 'S' },
  { value: 7, label: 'S' },
] as const;

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
