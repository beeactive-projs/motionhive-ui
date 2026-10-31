import {
  alertCircleOutline,
  barbellOutline,
  bodyOutline,
  calendarOutline,
  chevronDownOutline,
  closeOutline,
  compassOutline,
  desktopOutline,
  flameOutline,
  leafOutline,
  locationOutline,
  lockClosedOutline,
  peopleOutline,
  searchOutline,
  timeOutline,
  videocamOutline,
  walkOutline,
} from 'ionicons/icons';

import {
  DiscoverFilters,
  DiscoverGroup,
  InstructorSearchResult,
  JoinPolicies,
  PublicSessionInstance,
  SESSION_LOCATION_KINDS,
  SESSION_TYPES,
  SessionInstructorRef,
  SessionLocationKind,
  SessionType,
  UserRoles,
  endOfDay,
  enumLabel,
  foldForSearch,
  formatSessionDayShort,
  formatSessionTime,
  startOfDay,
  weekStart,
  formatMinorUnits,
  translate,
} from 'core';

import {
  ProfileStacks,
  groupBase,
  personBase,
  stackRootOf,
} from '../../_shared/utils/stack-paths';

/**
 * The Discover surface's pure brain: spine tones, price parts, spots and
 * full/waitlist chips, the date-preset compiler, the quick-filter chip
 * model, the coach and group lines, the goals and cities that filter the
 * tab, the coach of the week, search's recents and highlights, and the
 * links that keep Discover's screens in whichever stack mounts them.
 *
 * Everything derives from a `PublicSessionInstance` / `InstructorSearchResult`
 * and a clock — no signals, no Ionic — so the design's invariants ("the spine
 * says type, never status", "no counts, no ranking") are testable without a
 * component in sight. The trainee twin is `../user/sessions/my-sessions.config.ts`.
 */

/** Every icon this feature renders — same guard idea as the other configs. */
export const DISCOVER_ICONS = {
  alertCircleOutline,
  barbellOutline,
  bodyOutline,
  calendarOutline,
  chevronDownOutline,
  closeOutline,
  compassOutline,
  desktopOutline,
  flameOutline,
  leafOutline,
  locationOutline,
  lockClosedOutline,
  peopleOutline,
  searchOutline,
  timeOutline,
  videocamOutline,
  walkOutline,
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
  return i.titleOverride ?? i.template?.title ?? translate('common.session');
}

export function discoverCoach(i: PublicSessionInstance): SessionInstructorRef | null {
  return i.instructor ?? i.template?.instructor ?? null;
}

export function isOnlineSession(i: PublicSessionInstance): boolean {
  return i.template?.locationKind === SessionLocationKind.Online;
}

/** "Online" or the venue's name. */
export function discoverPlace(i: PublicSessionInstance): string {
  if (isOnlineSession(i)) return SESSION_LOCATION_KINDS[SessionLocationKind.Online].label;
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
  return {
    free: false,
    amount: formatMinorUnits(cents, { trimWholeNumbers: true }),
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
  return translate('discover.row.spots', {
    confirmed: Math.min(i.confirmedCount, capacity),
    capacity,
  });
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
    ? { label: translate('discover.row.fullWaitlist'), tone: 'info' }
    : { label: translate('discover.row.full'), tone: 'medium' };
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

/** `label` is a translation key — the sheet's template translates it. */
export const DATE_PRESET_OPTIONS: { label: string; value: DiscoverDatePreset }[] = [
  { label: 'discover.filterSheet.datePreset.any', value: DiscoverDatePresets.Any },
  { label: 'discover.filterSheet.datePreset.thisWeek', value: DiscoverDatePresets.ThisWeek },
  { label: 'discover.filterSheet.datePreset.weekend', value: DiscoverDatePresets.Weekend },
  { label: 'discover.filterSheet.datePreset.twoWeeks', value: DiscoverDatePresets.TwoWeeks },
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

/** Labels are core's session-type metadata getters — translated on read. */
export const DISCOVER_TYPE_OPTIONS: { readonly label: string; value: SessionType }[] = [
  SessionType.Group,
  SessionType.Private,
  SessionType.Open,
].map((value) => ({
  value,
  get label() {
    return SESSION_TYPES[value].label;
  },
}));

export const DISCOVER_LOCATION_OPTIONS: {
  readonly label: string;
  value: SessionLocationKind;
}[] = [SessionLocationKind.Online, SessionLocationKind.InPerson].map((value) => ({
  value,
  get label() {
    return SESSION_LOCATION_KINDS[value].label;
  },
}));

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
  /** Translated on read (a getter), so the module can build it at load time. */
  readonly label: string;
  /** What tapping the chip writes into the store — explicit undefineds so
      the patch clears the dimension it does not set. */
  patch: Partial<DiscoverFilters>;
}

export const QUICK_FILTERS: DiscoverQuickFilter[] = [
  {
    id: QuickFilterIds.All,
    get label() {
      return translate('common.all');
    },
    patch: { type: undefined, locationKind: undefined },
  },
  {
    id: QuickFilterIds.Online,
    get label() {
      return SESSION_LOCATION_KINDS[SessionLocationKind.Online].label;
    },
    patch: { locationKind: SessionLocationKind.Online, type: undefined },
  },
  {
    id: QuickFilterIds.InPerson,
    get label() {
      return SESSION_LOCATION_KINDS[SessionLocationKind.InPerson].label;
    },
    patch: { locationKind: SessionLocationKind.InPerson, type: undefined },
  },
  {
    id: QuickFilterIds.Group,
    get label() {
      return SESSION_TYPES[SessionType.Group].label;
    },
    patch: { type: SessionType.Group, locationKind: undefined },
  },
  {
    id: QuickFilterIds.OneOnOne,
    get label() {
      return SESSION_TYPES[SessionType.Private].label;
    },
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
    enumLabel('userRole', UserRoles.Instructor)
  );
}

function trimmed(parts: readonly (string | null | undefined)[]): string[] {
  return parts.map((part) => part?.trim()).filter((part): part is string => !!part);
}

/** "6 yrs", or null for a coach who gives none. */
export function coachYears(c: InstructorSearchResult): string | null {
  const years = c.yearsOfExperience;
  return years && years > 0 ? translate('discover.coach.years', { count: years }) : null;
}

/**
 * A coach row's second line in the lists and in search: what they coach,
 * then where ("Forță · Alergare · Mobilitate · Cluj-Napoca"). With neither
 * on the profile, the experience stands in; a missing or zero experience
 * reads "New coach".
 */
export function coachSubline(c: InstructorSearchResult): string {
  const parts = trimmed([...(c.specializations ?? []), c.city]);
  if (parts.length > 0) return parts.join(' · ');
  const years = c.yearsOfExperience;
  return years && years > 0
    ? translate('discover.coach.experience', { count: years })
    : translate('discover.coach.newCoach');
}

/**
 * The line under a name on Discover's "Coaches near you": two of their
 * specialties, then the years they have coached, or the city when the list
 * spans every city (a list of one city does not need it repeated).
 */
export function coachNearLine(c: InstructorSearchResult, withCity: boolean): string {
  const specs = trimmed(c.specializations ?? []).slice(0, 2);
  const tail = withCity ? c.city?.trim() || coachYears(c) : coachYears(c) || c.city?.trim();
  const parts = trimmed([...specs, tail]);
  return parts.length > 0 ? parts.join(' · ') : coachSubline(c);
}

/** The featured card's facts: up to three specialties and the years. */
export function coachFacts(c: InstructorSearchResult): string {
  return trimmed([...(c.specializations ?? []).slice(0, 3), coachYears(c)]).join(' · ');
}

/** A coach row's one badge: Online for a coach who coaches online, else
    Taking clients while the door is open, else nothing. */
export interface CoachBadge {
  label: string;
  tone: 'teal' | 'success';
}

export function coachBadge(c: InstructorSearchResult): CoachBadge | null {
  if (coachMatchesGoal(c, DiscoverGoalIds.Online)) {
    return { label: translate('discover.coachRow.online'), tone: 'teal' };
  }
  if (c.isAcceptingClients) {
    return { label: translate('discover.coachRow.takingClients'), tone: 'success' };
  }
  return null;
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

/** Everyone but the reader: Discover never pitches a coach to themselves. */
export function withoutReader<T extends { userId: string }>(list: readonly T[], readerId: string | null | undefined): T[] {
  return readerId ? list.filter((item) => item.userId !== readerId) : [...list];
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

/**
 * The featured card's quote: the first sentence of the bio, tidied, cut at
 * a word with an ellipsis when it runs long. Null without a bio: the card
 * then has no quote line rather than an empty pair of marks.
 */
export function bioQuote(bio: string | null | undefined, max = 140): string | null {
  const text = (bio ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const sentence = (text.match(/^.+?[.!?…](?=\s|$)/)?.[0] ?? text).trim();
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, '')}…`;
}

// ─── Coach of the week ─────────────────────────────────────────────────────

/** The ISO 8601 week number (weeks start on Monday; week 1 holds the
    year's first Thursday), in the reader's local calendar. */
export function isoWeek(date: Date): number {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  return Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export interface CoachOfTheWeekOptions {
  /** The city Discover shows (`cityKey`), or null for everywhere. */
  cityKey: string | null;
  readerId: string | null | undefined;
  goal: DiscoverGoalId | null;
  now: Date;
}

/**
 * One coach taking clients, chosen by the week of the year so it changes
 * every Monday and is the same for everyone looking at the same city that
 * week. Among the city's coaches first, and every city's when that one has
 * nobody; a goal narrows the pool like it narrows the rest of the tab. The
 * pool is ordered by id and counts the reader, so the pick does not depend
 * on who is looking; landing on the reader moves on to the next coach.
 */
export function coachOfTheWeek(
  coaches: readonly InstructorSearchResult[],
  options: CoachOfTheWeekOptions,
): InstructorSearchResult | null {
  const open = coaches
    .filter((coach) => coach.isAcceptingClients && coachMatchesGoal(coach, options.goal))
    .sort((a, b) => a.id.localeCompare(b.id));
  const local = options.cityKey
    ? open.filter((coach) => cityKey(coach.city) === options.cityKey)
    : open;
  const pool = local.some((coach) => coach.userId !== options.readerId) ? local : open;
  if (pool.length === 0) return null;
  const start = isoWeek(options.now) % pool.length;
  for (let step = 0; step < pool.length; step++) {
    const pick = pool[(start + step) % pool.length];
    if (pick.userId !== options.readerId) return pick;
  }
  return null;
}

// ─── Goals ─────────────────────────────────────────────────────────────────

export const DiscoverGoalIds = {
  Strength: 'strength',
  Running: 'running',
  FatLoss: 'fat-loss',
  Mobility: 'mobility',
  Beginners: 'beginners',
  Online: 'online',
} as const;

export type DiscoverGoalId = (typeof DiscoverGoalIds)[keyof typeof DiscoverGoalIds];

export interface DiscoverGoal {
  id: DiscoverGoalId;
  /** The band's short chip, a translation key; null where the band has no chip. */
  chip: string | null;
  /** The search page's browse card, a translation key. */
  card: string;
  icon: string;
  /**
   * How a word starts when it means this goal, folded (no accents, lower
   * case), in English and Romanian: "alerg" finds "Alergare" and "Alergăm",
   * "incepat" finds "începători".
   */
  words: readonly string[];
}

export const DISCOVER_GOALS: Readonly<Record<DiscoverGoalId, DiscoverGoal>> = {
  [DiscoverGoalIds.Strength]: {
    id: DiscoverGoalIds.Strength,
    chip: 'discover.goals.strength',
    card: 'discover.browse.strength',
    icon: 'barbell-outline',
    words: ['strength', 'forta', 'power', 'lift', 'haltere', 'putere', 'musculat', 'bodybuild', 'culturism'],
  },
  [DiscoverGoalIds.Running]: {
    id: DiscoverGoalIds.Running,
    chip: 'discover.goals.running',
    card: 'discover.browse.running',
    icon: 'walk-outline',
    words: ['run', 'alerg', 'jog', 'marathon', 'maraton', 'trail'],
  },
  [DiscoverGoalIds.FatLoss]: {
    id: DiscoverGoalIds.FatLoss,
    chip: null,
    card: 'discover.browse.fatLoss',
    icon: 'flame-outline',
    words: ['fat', 'loss', 'slab', 'hiit', 'cardio', 'grasim', 'tonifi'],
  },
  [DiscoverGoalIds.Mobility]: {
    id: DiscoverGoalIds.Mobility,
    chip: 'discover.goals.mobility',
    card: 'discover.browse.mobility',
    icon: 'body-outline',
    words: ['mobil', 'stretch', 'flexib', 'yoga', 'pilates', 'postur', 'intinder'],
  },
  [DiscoverGoalIds.Beginners]: {
    id: DiscoverGoalIds.Beginners,
    chip: 'discover.goals.beginners',
    card: 'discover.browse.beginners',
    icon: 'leaf-outline',
    words: ['beginner', 'incepat', 'starter', 'novice', 'debutant'],
  },
  [DiscoverGoalIds.Online]: {
    id: DiscoverGoalIds.Online,
    chip: 'discover.goals.online',
    card: 'discover.browse.online',
    icon: 'desktop-outline',
    words: ['online', 'remote', 'virtual'],
  },
};

/** The band's chips, in the design's order. */
export const GOAL_CHIPS: readonly DiscoverGoalId[] = [
  DiscoverGoalIds.Strength,
  DiscoverGoalIds.Running,
  DiscoverGoalIds.Beginners,
  DiscoverGoalIds.Online,
  DiscoverGoalIds.Mobility,
];

/** Search's "Browse by goal" cards, two to a row. */
export const BROWSE_GOALS: readonly DiscoverGoalId[] = [
  DiscoverGoalIds.Strength,
  DiscoverGoalIds.Running,
  DiscoverGoalIds.FatLoss,
  DiscoverGoalIds.Mobility,
  DiscoverGoalIds.Beginners,
  DiscoverGoalIds.Online,
];

/** Whether any of `texts` has a word that starts like one of the goal's. */
export function textMatchesGoal(
  texts: readonly (string | null | undefined)[],
  goal: DiscoverGoalId,
): boolean {
  const starts = DISCOVER_GOALS[goal].words;
  return texts.some((text) =>
    foldForSearch(text ?? '')
      .split(/[^a-z0-9]+/)
      .some((word) => word !== '' && starts.some((start) => word.startsWith(start))),
  );
}

/** A coach by what they coach; no goal matches everyone. */
export function coachMatchesGoal(c: InstructorSearchResult, goal: DiscoverGoalId | null): boolean {
  return !goal || textMatchesGoal(c.specializations ?? [], goal);
}

/** A group by its name and tags. */
export function groupMatchesGoal(g: DiscoverGroup, goal: DiscoverGoalId | null): boolean {
  return !goal || textMatchesGoal([g.name, ...(g.tags ?? [])], goal);
}

/** A session by its title, and Online by where it happens. */
export function sessionMatchesGoal(i: PublicSessionInstance, goal: DiscoverGoalId | null): boolean {
  if (!goal) return true;
  if (goal === DiscoverGoalIds.Online) return isOnlineSession(i);
  return textMatchesGoal([discoverTitle(i), i.template?.group?.name], goal);
}

// ─── Cities ────────────────────────────────────────────────────────────────

/** Sentinel for the city sheet's "Everywhere" row and its stored choice. */
export const EVERYWHERE = 'everywhere';

/** Exonyms that fold to a different word than the city's own name. */
const CITY_ALIASES: Readonly<Record<string, string>> = {
  bucharest: 'bucuresti',
  bukarest: 'bucuresti',
};

/**
 * One key per city however it is typed: folded ("Timișoara" and
 * "Timisoara" agree), spaces squeezed, and "Bucharest" read as
 * "București". Null for no city.
 */
export function cityKey(city: string | null | undefined): string | null {
  const folded = foldForSearch((city ?? '').trim()).replace(/\s+/g, ' ');
  if (!folded) return null;
  return CITY_ALIASES[folded] ?? folded;
}

/** Where an in-person session happens: the occurrence's venue, then the template's. */
export function sessionCity(i: PublicSessionInstance): string | null {
  return i.venueOverride?.city ?? i.template?.venue?.city ?? null;
}

export interface DiscoverCity {
  key: string;
  /** As people write it, accents kept where any spelling had them. */
  label: string;
}

/** The cities Discover can show: every city a coach, group or session is
    in, one row each, by name. */
export function discoverCities(
  coaches: readonly InstructorSearchResult[],
  groups: readonly DiscoverGroup[],
  sessions: readonly PublicSessionInstance[],
): DiscoverCity[] {
  const byKey = new Map<string, string>();
  const names = [
    ...coaches.map((coach) => coach.city),
    ...groups.map((group) => group.city),
    ...sessions.map(sessionCity),
  ];
  for (const raw of names) {
    const label = raw?.trim();
    const key = cityKey(label);
    if (!label || !key) continue;
    const seen = byKey.get(key);
    // The spelling with its diacritics wins: "București" over "Bucharest".
    if (!seen || (!/[^\u0000-\u007f]/.test(seen) && /[^\u0000-\u007f]/.test(label))) {
      byKey.set(key, label);
    }
  }
  return [...byKey]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * The city Discover shows. The one picked on this phone, while it still
 * has something in it; otherwise the reader's own city when something is
 * there; otherwise everywhere (null), so nobody opens the tab on an empty
 * city.
 */
export function resolveCity(
  chosen: string | null,
  accountCity: string | null | undefined,
  cities: readonly DiscoverCity[],
): DiscoverCity | null {
  if (chosen === EVERYWHERE) return null;
  const find = (key: string | null) => (key ? cities.find((city) => city.key === key) ?? null : null);
  return find(chosen) ?? find(cityKey(accountCity));
}

/** In the shown city, or anything when everywhere is shown. */
export function inCity(city: string | null | undefined, key: string | null): boolean {
  return !key || cityKey(city) === key;
}

/** An online session is in every city. */
export function sessionInCity(i: PublicSessionInstance, key: string | null): boolean {
  return !key || isOnlineSession(i) || cityKey(sessionCity(i)) === key;
}

// ─── Groups ────────────────────────────────────────────────────────────────

/** "12 members · Cluj-Napoca", led by "Request pending" once the reader has
    asked to join, so the row does not read as untouched. In parts, so a
    card can keep each one whole ("Cluj-Napoca" never splits at its hyphen). */
export function discoverGroupMetaParts(g: DiscoverGroup): string[] {
  return trimmed([
    g.myJoinRequestStatus === 'PENDING' ? translate('groups.join.pending') : null,
    translate('count.members', { count: g.memberCount }),
    g.city,
  ]);
}

export function discoverGroupMeta(g: DiscoverGroup): string {
  return discoverGroupMetaParts(g).join(' · ');
}

export const GroupVerbs = {
  Join: 'join',
  Request: 'request',
} as const;

export type GroupVerb = (typeof GroupVerbs)[keyof typeof GroupVerbs];

/**
 * The verb a search row offers: Join for an open group, Request for one
 * that asks the owner first, nothing once a request is waiting (the line
 * says so) or for a group nobody can ask to join.
 */
export function groupVerb(g: DiscoverGroup): { verb: GroupVerb; label: string } | null {
  if (g.myJoinRequestStatus === 'PENDING') return null;
  switch (g.joinPolicy) {
    case JoinPolicies.Open:
      return { verb: GroupVerbs.Join, label: translate('discover.search.join') };
    case JoinPolicies.Approval:
      return { verb: GroupVerbs.Request, label: translate('discover.search.request') };
    default:
      return null;
  }
}

// ─── Search ────────────────────────────────────────────────────────────────

export const SearchKinds = {
  All: 'all',
  Coaches: 'coaches',
  Groups: 'groups',
  Sessions: 'sessions',
} as const;

export type SearchKind = (typeof SearchKinds)[keyof typeof SearchKinds];

/** The result chips, labels as translation keys. */
export const SEARCH_KIND_OPTIONS: readonly { id: SearchKind; label: string }[] = [
  { id: SearchKinds.All, label: 'common.all' },
  { id: SearchKinds.Coaches, label: 'discover.search.coaches' },
  { id: SearchKinds.Groups, label: 'discover.search.groups' },
  { id: SearchKinds.Sessions, label: 'discover.search.sessions' },
];

/** A session in a search result: "Sat 7 Nov · 07:00 · Irina Moldovan". */
export function sessionResultLine(i: PublicSessionInstance): string {
  const coach = discoverCoach(i);
  const name = coach ? [coach.firstName, coach.lastName].filter(Boolean).join(' ').trim() : '';
  return [formatSessionDayShort(i.startAt), formatSessionTime(i.startAt), name]
    .filter(Boolean)
    .join(' · ');
}

export interface TextPart {
  text: string;
  match: boolean;
}

/**
 * `text` cut into the runs that match `term` and the runs between, blind to
 * case and accents the way the server's search is ("forta" lights "Forță"),
 * so a result can show why it matched. Indices are per code point, and a
 * combining accent stays with its letter.
 */
export function highlightParts(text: string, term: string): TextPart[] {
  const needle = foldForSearch(term.trim());
  if (!needle || !text) return [{ text, match: false }];

  const chars = Array.from(text);
  let folded = '';
  const origin: number[] = [];
  chars.forEach((char, index) => {
    const piece = foldForSearch(char);
    for (let k = 0; k < piece.length; k++) origin.push(index);
    folded += piece;
  });

  const parts: TextPart[] = [];
  let from = 0;
  let at = folded.indexOf(needle);
  while (at !== -1) {
    const start = origin[at];
    let end = origin[at + needle.length - 1] + 1;
    // A combining mark folds to nothing: keep it with the letter it marks.
    while (end < chars.length && foldForSearch(chars[end]) === '') end++;
    if (start > from) parts.push({ text: chars.slice(from, start).join(''), match: false });
    parts.push({ text: chars.slice(start, end).join(''), match: true });
    from = end;
    const next = origin.findIndex((charIndex) => charIndex >= end);
    at = next === -1 ? -1 : folded.indexOf(needle, next);
  }
  if (from < chars.length) parts.push({ text: chars.slice(from).join(''), match: false });
  return parts;
}

/**
 * The first spelling the results matched that differs from what was typed
 * only by its accents ("forță" for "forta"), lower case; null when every
 * match is spelled as typed. Search's footnote names it.
 */
export function accentVariant(texts: readonly (string | null | undefined)[], term: string): string | null {
  const typed = term.trim().toLocaleLowerCase();
  if (!foldForSearch(typed)) return null;
  for (const text of texts) {
    for (const part of highlightParts(text ?? '', typed)) {
      const spelled = part.text.toLocaleLowerCase();
      if (part.match && spelled !== typed) return spelled;
    }
  }
  return null;
}

// ─── Recents ───────────────────────────────────────────────────────────────

export const RecentKinds = {
  Query: 'query',
  Coach: 'coach',
  Group: 'group',
} as const;

/** What search's Recent list keeps on the phone: a search, or a coach or
    group a search was opened on. Raw data, worded when it is drawn. */
export type DiscoverRecent =
  | { kind: typeof RecentKinds.Query; text: string }
  | {
      kind: typeof RecentKinds.Coach;
      id: string;
      userId: string;
      handle: string;
      name: string;
      avatarUrl: string | null;
      city: string | null;
    }
  | {
      kind: typeof RecentKinds.Group;
      id: string;
      name: string;
      logoUrl: string | null;
      city: string | null;
    };

export const RECENT_LIMIT = 5;

/** One entry per search (accents and case aside) and per coach or group. */
export function recentKey(entry: DiscoverRecent): string {
  switch (entry.kind) {
    case RecentKinds.Query:
      return `q:${foldForSearch(entry.text.trim())}`;
    case RecentKinds.Coach:
      return `c:${entry.id}`;
    case RecentKinds.Group:
      return `g:${entry.id}`;
  }
}

/** Newest first, a repeat moved to the top, at most `RECENT_LIMIT`. */
export function pushRecent(
  list: readonly DiscoverRecent[],
  entry: DiscoverRecent,
  max = RECENT_LIMIT,
): DiscoverRecent[] {
  const key = recentKey(entry);
  return [entry, ...list.filter((item) => recentKey(item) !== key)].slice(0, max);
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string';

/** Whatever storage held, kept only where it is a well-formed entry. */
export function parseRecents(raw: unknown): DiscoverRecent[] {
  if (!Array.isArray(raw)) return [];
  const out: DiscoverRecent[] = [];
  for (const item of raw as Record<string, unknown>[]) {
    if (!item || typeof item !== 'object') continue;
    if (item['kind'] === RecentKinds.Query && isText(item['text'])) {
      out.push({ kind: RecentKinds.Query, text: item['text'] });
    } else if (
      item['kind'] === RecentKinds.Coach &&
      isText(item['id']) &&
      isText(item['userId']) &&
      isText(item['handle']) &&
      isText(item['name'])
    ) {
      out.push({
        kind: RecentKinds.Coach,
        id: item['id'],
        userId: item['userId'],
        handle: item['handle'],
        name: item['name'],
        avatarUrl: isTextOrNull(item['avatarUrl']) ? item['avatarUrl'] : null,
        city: isTextOrNull(item['city']) ? item['city'] : null,
      });
    } else if (item['kind'] === RecentKinds.Group && isText(item['id']) && isText(item['name'])) {
      out.push({
        kind: RecentKinds.Group,
        id: item['id'],
        name: item['name'],
        logoUrl: isTextOrNull(item['logoUrl']) ? item['logoUrl'] : null,
        city: isTextOrNull(item['city']) ? item['city'] : null,
      });
    }
  }
  return out.slice(0, RECENT_LIMIT);
}

// ─── Links ─────────────────────────────────────────────────────────────────

/**
 * Where Discover's screens send a tap, from the stack their URL is in. The
 * coach and group lists and search are mounted in Discover and in Home;
 * whichever opened them, a coach, a group or a session opens in that same
 * stack, so back returns there (`stack-paths.ts`). Anywhere else falls back
 * to Discover's own.
 */
export function discoverLinks(url: string) {
  const inHome = stackRootOf(url) === ProfileStacks.Home;
  const root = inHome ? ProfileStacks.Home : ProfileStacks.Discover;
  return {
    root,
    person: (handle: string) => [personBase(root), handle],
    /** A group seen from outside: Discover's own preview route, or the
        preview every other stack mounts beside a profile. */
    groupPreview: (groupId: string) =>
      inHome ? [groupBase(root), 'preview', groupId] : [`${root}/group`, groupId],
    /** The group itself, once the reader is in. */
    group: (groupId: string) => [groupBase(root), groupId],
    session: (instanceId: string) => (inHome ? [root, 'booking', instanceId] : [root, instanceId]),
    allCoaches: `${root}/coaches`,
    allGroups: inHome ? `${root}/groups-to-join` : `${root}/groups`,
    search: `${root}/search`,
  };
}
