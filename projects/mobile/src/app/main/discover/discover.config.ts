import {
  alertCircleOutline,
  arrowForward,
  calendarOutline,
  compassOutline,
  peopleOutline,
  searchOutline,
  videocamOutline,
} from 'ionicons/icons';

import {
  DiscoverFilters,
  InstructorSearchResult,
  PublicSessionInstance,
  SessionInstructorRef,
  SessionLocationKind,
  SessionType,
  endOfDay,
  startOfDay,
  weekStart,
} from 'core';

/**
 * The Discover surface's pure brain: spine tones, price parts, spots and
 * full/waitlist chips, the date-preset compiler, the quick-filter chip
 * model, and the coach-list helpers.
 *
 * Everything derives from a `PublicSessionInstance` / `InstructorSearchResult`
 * and a clock — no signals, no Ionic — so the design's invariants ("the spine
 * says type, never status", "no counts, no ranking") are testable without a
 * component in sight. The trainee twin is `../user/sessions/my-sessions.config.ts`.
 */

/** Every icon this feature renders — same guard idea as the other configs. */
export const DISCOVER_ICONS = {
  alertCircleOutline,
  arrowForward,
  calendarOutline,
  compassOutline,
  peopleOutline,
  searchOutline,
  videocamOutline,
};

// ─── Spine tone ────────────────────────────────────────────────────────────

/**
 * Discover's row spine answers "what kind of session is this", keyed to the
 * session TYPE. The design's mapping deliberately diverges from core's
 * `SESSION_TYPES` tones (there Group=honey, Private=navy — the coach agenda
 * reads those): here 1-on-1 is honey, group is violet, open is teal. Do not
 * "fix" either to match the other.
 */
export const DiscoverTones = {
  /** 1-on-1 — honey. */
  Private: 'honey',
  /** Group class — violet. */
  Group: 'violet',
  /** Open session — teal. */
  Open: 'teal',
} as const;

export type DiscoverTone = (typeof DiscoverTones)[keyof typeof DiscoverTones];

export function discoverTone(type: SessionType | undefined): DiscoverTone | null {
  switch (type) {
    case SessionType.Private:
      return DiscoverTones.Private;
    case SessionType.Group:
      return DiscoverTones.Group;
    case SessionType.Open:
      return DiscoverTones.Open;
    default:
      return null;
  }
}

// ─── Accessors (guarding the eager-loaded refs) ────────────────────────────

export function discoverTitle(i: PublicSessionInstance): string {
  return i.titleOverride ?? i.template?.title ?? 'Session';
}

export function discoverCoach(i: PublicSessionInstance): SessionInstructorRef | null {
  return i.instructor ?? i.template?.instructor ?? null;
}

export function isOnlineSession(i: PublicSessionInstance): boolean {
  return i.template?.locationKind === SessionLocationKind.Online;
}

/** "Online" or the venue's name. */
export function discoverPlace(i: PublicSessionInstance): string {
  if (isOnlineSession(i)) return 'Online';
  return i.venueOverride?.name ?? i.template?.venue?.name ?? '';
}

/** "Ana Popescu · Online" — the row's second line. Full name, not "with
    Ana": on Discover the coach is a stranger being introduced. */
export function discoverMeta(i: PublicSessionInstance): string {
  const coach = discoverCoach(i);
  const name = coach
    ? [coach.firstName, coach.lastName].filter(Boolean).join(' ').trim()
    : '';
  return [name, discoverPlace(i)].filter(Boolean).join(' · ');
}

// ─── Price ─────────────────────────────────────────────────────────────────

export type SessionPriceParts =
  | { free: true }
  | { free: false; amount: string; currency: string };

/**
 * The row's two-line mono price block needs amount and currency separately,
 * which is why this is parts rather than a string — but the rendering rules
 * are `bookingPriceLabel`'s exactly (a spec pins the parity): 0 or less is
 * Free, whole amounts carry no decimals, the code is uppercased.
 */
export function sessionPriceParts(cents: number, currency: string): SessionPriceParts {
  if (cents <= 0) return { free: true };
  const amount = cents / 100;
  return {
    free: false,
    amount: Number.isInteger(amount) ? String(amount) : amount.toFixed(2),
    currency: currency.toUpperCase(),
  };
}

// ─── Spots / capacity ──────────────────────────────────────────────────────

/** Effective capacity — the instance override wins; null means unlimited. */
export function sessionCapacity(i: PublicSessionInstance): number | null {
  return i.capacityOverride ?? i.template?.capacity ?? null;
}

export function isSessionFull(i: PublicSessionInstance): boolean {
  const capacity = sessionCapacity(i);
  return capacity != null && capacity > 0 && i.confirmedCount >= capacity;
}

/**
 * "5 of 12 spots" — only while there is room, and never for a 1-on-1 (its
 * capacity is the seat you are looking at). A full session swaps this line
 * for the chip below.
 */
export function spotsLabel(i: PublicSessionInstance): string | null {
  const capacity = sessionCapacity(i);
  if (!capacity || capacity <= 0) return null;
  if (i.template?.type === SessionType.Private) return null;
  if (isSessionFull(i)) return null;
  return `${Math.min(i.confirmedCount, capacity)} of ${capacity} spots`;
}

/** Wash tone names — the badge SCSS maps each to an `--ion-color-*-wash`. */
export interface DiscoverRowChip {
  label: string;
  tone: 'info' | 'medium';
}

/** Sky "Full · waitlist" when the waitlist can still catch you, muted
    "Full" when it cannot. Null while there is room — space is the default
    and stays silent. */
export function fullChip(i: PublicSessionInstance): DiscoverRowChip | null {
  if (!isSessionFull(i)) return null;
  return i.template?.waitlistEnabled
    ? { label: 'Full · waitlist', tone: 'info' }
    : { label: 'Full', tone: 'medium' };
}

// ─── Date presets ──────────────────────────────────────────────────────────

export const DiscoverDatePresets = {
  Any: 'any',
  ThisWeek: 'this-week',
  Weekend: 'weekend',
  TwoWeeks: 'two-weeks',
} as const;

export type DiscoverDatePreset =
  (typeof DiscoverDatePresets)[keyof typeof DiscoverDatePresets];

export const DATE_PRESET_OPTIONS: { label: string; value: DiscoverDatePreset }[] = [
  { label: 'Any time', value: DiscoverDatePresets.Any },
  { label: 'This week', value: DiscoverDatePresets.ThisWeek },
  { label: 'This weekend', value: DiscoverDatePresets.Weekend },
  { label: 'Next two weeks', value: DiscoverDatePresets.TwoWeeks },
];

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/**
 * Presets compile to the `dateFrom`/`dateTo` ISO bounds the discover query
 * takes — the sheet never exposes raw pickers. `Any` compiles to explicit
 * undefineds so spreading the result into `setFilters` CLEARS a previous
 * window. All presets sit far inside the BE's 90-day cap.
 */
export function compileDatePreset(
  preset: DiscoverDatePreset,
  now: Date,
): { dateFrom: string | undefined; dateTo: string | undefined } {
  // `weekStart` is Monday-based, so Saturday/Sunday are +5/+6 from it.
  const sundayEnd = endOfDay(addDays(weekStart(now), 6));
  switch (preset) {
    case DiscoverDatePresets.ThisWeek:
      return { dateFrom: now.toISOString(), dateTo: sundayEnd.toISOString() };
    case DiscoverDatePresets.Weekend: {
      const day = now.getDay();
      const insideWeekend = day === 0 || day === 6;
      const saturdayStart = startOfDay(addDays(weekStart(now), 5));
      return {
        dateFrom: (insideWeekend ? now : saturdayStart).toISOString(),
        dateTo: sundayEnd.toISOString(),
      };
    }
    case DiscoverDatePresets.TwoWeeks:
      return {
        dateFrom: now.toISOString(),
        dateTo: endOfDay(addDays(now, 14)).toISOString(),
      };
    default:
      return { dateFrom: undefined, dateTo: undefined };
  }
}

// ─── Filter sheet contract ─────────────────────────────────────────────────

/** What the sheet edits. The page compiles `datePreset` to `dateFrom`/`dateTo`
    via `compileDatePreset` and pushes the result into the discover store. */
export interface DiscoverSheetFilters {
  type: SessionType | null;
  locationKind: SessionLocationKind | null;
  datePreset: DiscoverDatePreset;
}

export const NO_SHEET_FILTERS: DiscoverSheetFilters = {
  type: null,
  locationKind: null,
  datePreset: DiscoverDatePresets.Any,
};

export function sheetFilterCount(filters: DiscoverSheetFilters): number {
  let count = 0;
  if (filters.type) count++;
  if (filters.locationKind) count++;
  if (filters.datePreset !== DiscoverDatePresets.Any) count++;
  return count;
}

export const DISCOVER_TYPE_OPTIONS: { label: string; value: SessionType }[] = [
  { label: 'Group', value: SessionType.Group },
  { label: '1-on-1', value: SessionType.Private },
  { label: 'Open', value: SessionType.Open },
];

export const DISCOVER_LOCATION_OPTIONS: {
  label: string;
  value: SessionLocationKind;
}[] = [
  { label: 'Online', value: SessionLocationKind.Online },
  { label: 'In-person', value: SessionLocationKind.InPerson },
];

// ─── Quick filters (the chip row) ──────────────────────────────────────────

export const QuickFilterIds = {
  All: 'all',
  Online: 'online',
  InPerson: 'in-person',
  Group: 'group',
  OneOnOne: 'one-on-one',
} as const;

export type QuickFilterId = (typeof QuickFilterIds)[keyof typeof QuickFilterIds];

export interface DiscoverQuickFilter {
  id: QuickFilterId;
  label: string;
  /** What tapping the chip writes into the store — explicit undefineds so
      the patch clears the dimension it does not set. */
  patch: Partial<DiscoverFilters>;
}

export const QUICK_FILTERS: DiscoverQuickFilter[] = [
  {
    id: QuickFilterIds.All,
    label: 'All',
    patch: { type: undefined, locationKind: undefined },
  },
  {
    id: QuickFilterIds.Online,
    label: 'Online',
    patch: { locationKind: SessionLocationKind.Online, type: undefined },
  },
  {
    id: QuickFilterIds.InPerson,
    label: 'In-person',
    patch: { locationKind: SessionLocationKind.InPerson, type: undefined },
  },
  {
    id: QuickFilterIds.Group,
    label: 'Group',
    patch: { type: SessionType.Group, locationKind: undefined },
  },
  {
    id: QuickFilterIds.OneOnOne,
    label: '1-on-1',
    patch: { type: SessionType.Private, locationKind: undefined },
  },
];

/**
 * Selection is DERIVED from the store's filters rather than held as chip
 * state, so a combination applied through the sheet lights the right chip —
 * and a sheet-only combination (e.g. Group + Online, or type Open) lights
 * none, including All.
 */
export function quickFilterSelected(filters: DiscoverFilters, id: QuickFilterId): boolean {
  switch (id) {
    case QuickFilterIds.All:
      return !filters.type && !filters.locationKind;
    case QuickFilterIds.Online:
      return filters.locationKind === SessionLocationKind.Online && !filters.type;
    case QuickFilterIds.InPerson:
      return filters.locationKind === SessionLocationKind.InPerson && !filters.type;
    case QuickFilterIds.Group:
      return filters.type === SessionType.Group && !filters.locationKind;
    case QuickFilterIds.OneOnOne:
      return filters.type === SessionType.Private && !filters.locationKind;
  }
}

// ─── Coaches ───────────────────────────────────────────────────────────────

export function coachName(c: InstructorSearchResult): string {
  return (
    c.displayName?.trim() ||
    [c.firstName, c.lastName].filter(Boolean).join(' ').trim() ||
    'Coach'
  );
}

/** "Bucharest, RO · 8 yrs experience" — location silently absent when the
    profile has none; a missing or zero experience reads "New coach". */
export function coachMeta(c: InstructorSearchResult): string {
  const location = [c.city, c.country].filter(Boolean).join(', ');
  const years = c.yearsOfExperience;
  const experience =
    years && years > 0 ? `${years} yrs experience` : 'New coach';
  return [location, experience].filter(Boolean).join(' · ');
}

export function coachSpecializations(c: InstructorSearchResult): string {
  return (c.specializations ?? []).join(' · ');
}

/** Accepting-first, then by name — the only honest sort the payload offers. */
export function sortCoaches(list: InstructorSearchResult[]): InstructorSearchResult[] {
  return [...list].sort((a, b) => {
    if (a.isAcceptingClients !== b.isAcceptingClients) {
      return a.isAcceptingClients ? -1 : 1;
    }
    return coachName(a).localeCompare(coachName(b));
  });
}

/**
 * The all-coaches filter chips come from the coaches themselves — deduped
 * case-insensitively (first casing wins), sorted — never a hardcoded list
 * that can drift from what coaches actually type into their profiles.
 */
export function specializationOptions(list: InstructorSearchResult[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const coach of list) {
    for (const raw of coach.specializations ?? []) {
      const label = raw.trim();
      const key = label.toLowerCase();
      if (!label || seen.has(key)) continue;
      seen.add(key);
      out.push(label);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export function matchesSpecialization(
  c: InstructorSearchResult,
  spec: string | null,
): boolean {
  if (!spec) return true;
  const needle = spec.trim().toLowerCase();
  return (c.specializations ?? []).some((s) => s.trim().toLowerCase() === needle);
}
