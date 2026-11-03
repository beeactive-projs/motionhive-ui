import {
  CoachDirectoryParams,
  CoachDirectorySort,
  CoachDirectorySorts,
  CoachFacet,
  InstructorSearchResult,
  foldedIncludes,
} from 'core';

import { ProfileStacks } from '../../_shared/utils/stack-paths';
import { EVERYWHERE, cityKey, coachName } from '../discover/discover.config';

/**
 * What the Coaches screen is looking at: the coach directory, narrowed by a
 * quick chip, the filter sheet behind the Filters chip, or the search field;
 * or, on the Yours chip, the reader's own coaches and the invitations waiting
 * on them. Requests narrows it to the coaches the reader asked.
 *
 * Everything here is pure, so `coaches.config.spec.ts` covers it.
 */

/** The directory's own stack. Discover lights while the reader is in it. */
export const COACHES_URL = ProfileStacks.Coaches;

/** Back on a cold load: Discover, whose button lights here. */
export const COACHES_BACK_DEFAULT = ProfileStacks.Discover;

export const CoachFilterIds = {
  All: 'all',
  Yours: 'yours',
  Requests: 'requests',
  NearYou: 'near',
  Online: 'online',
} as const;

export type CoachFilterId = (typeof CoachFilterIds)[keyof typeof CoachFilterIds];

export interface CoachFilter {
  id: CoachFilterId;
  /** Translation key. */
  label: string;
}

/**
 * The quick chips. Yours is the reader's own coaches, not a narrowing of the
 * directory; the rest are directory lenses the API applies. Requests is the
 * coaches the reader asked, still waiting on an answer, under the invitations
 * waiting on the reader.
 */
export const COACH_FILTERS: readonly CoachFilter[] = [
  { id: CoachFilterIds.All, label: 'coaches.filters.all' },
  { id: CoachFilterIds.Yours, label: 'coaches.filters.yours' },
  { id: CoachFilterIds.Requests, label: 'coaches.filters.requests' },
  { id: CoachFilterIds.NearYou, label: 'coaches.filters.nearYou' },
  { id: CoachFilterIds.Online, label: 'coaches.filters.online' },
];

/**
 * The query param that opens the screen on a chip: the Menu's Coaches row
 * lands on `?filter=yours`. `_shared/utils/stack-paths.ts` spells the same URL
 * out (`MY_COACHES_URL`), since it may not import from here.
 */
export const COACH_FILTER_PARAM = 'filter';

/** The screen, opened on the reader's own coaches. */
export const COACHES_YOURS_URL = `${COACHES_URL}?${COACH_FILTER_PARAM}=${CoachFilterIds.Yours}`;

/**
 * The chip a Coaches URL asks for, or null when it asks for none (or for one
 * that does not exist). Only the screen's own root counts: a profile pushed
 * from it carries no chip.
 */
export function filterFromUrl(url: string): CoachFilterId | null {
  const [path, query = ''] = url.split('#')[0].split('?');
  if (path !== COACHES_URL) return null;
  const value = new URLSearchParams(query).get(COACH_FILTER_PARAM);
  return COACH_FILTERS.find((filter) => filter.id === value)?.id ?? null;
}

/**
 * Where back goes on this screen: the screen it was opened from. It is a
 * stack root with three doors (Discover, Home, the Menu), so a fixed target
 * would send two of them somewhere they never were. A URL inside the screen's
 * own stack (a profile it opened, its notifications) says nothing about the
 * door, so the current target stands; the query is dropped, so a back never
 * replays an instruction a URL once carried.
 */
export function backHrefFrom(previousUrl: string | null | undefined, current: string): string {
  const path = previousUrl?.split(/[?#]/)[0];
  if (!path || !path.startsWith('/tabs/')) return current;
  if (path === COACHES_URL || path.startsWith(`${COACHES_URL}/`)) return current;
  return path;
}

/**
 * The shortest term the API is asked to search on. A single letter would
 * match half the directory; it is held back and narrows the rows already on
 * screen instead, and the field says so. Same floor as the other searches.
 */
export const MIN_SEARCH_LENGTH = 2;

/** The rows on screen, narrowed in memory while a newer term is on its way. */
export function matchesCoachQuery(coach: InstructorSearchResult, query: string): boolean {
  return (
    foldedIncludes(coachName(coach), query) ||
    foldedIncludes(coach.city ?? '', query) ||
    (coach.specializations ?? []).some((spec) => foldedIncludes(spec, query))
  );
}

// ── The filter sheet ─────────────────────────────────────────────────────────

/** What the Filters chip's sheet holds. Applied together, on Apply. */
export interface CoachSheetFilters {
  sort: CoachDirectorySort;
  /** Any of them; the facet labels, as the API matches them. */
  specializations: readonly string[];
  /** A facet city's label, or null for everywhere. */
  city: string | null;
  /** At least this many years; null for any. */
  minYears: number | null;
}

export const NO_SHEET_FILTERS: CoachSheetFilters = {
  sort: CoachDirectorySorts.Recommended,
  specializations: [],
  city: null,
  minYears: null,
};

/** Whether the sheet narrows the list, as opposed to only reordering it. */
export function sheetNarrows(filters: CoachSheetFilters): boolean {
  return filters.specializations.length > 0 || !!filters.city || !!filters.minYears;
}

/**
 * The number on the Filters chip and the sheet's Apply button: one per pick,
 * a sort other than the default included, since it changes the list too.
 */
export function sheetFilterCount(filters: CoachSheetFilters): number {
  return (
    (filters.sort !== CoachDirectorySorts.Recommended ? 1 : 0) +
    filters.specializations.length +
    (filters.city ? 1 : 0) +
    (filters.minYears ? 1 : 0)
  );
}

/** The sheet's Experience choices: any, then at least that many years. */
export const EXPERIENCE_OPTIONS: readonly (number | null)[] = [null, 2, 5, 10];

/** The sheet's Sort choices, in the order the sheet lists them. */
export const SORT_OPTIONS: readonly { value: CoachDirectorySort; label: string }[] = [
  { value: CoachDirectorySorts.Recommended, label: 'coaches.filter.sort.recommended' },
  { value: CoachDirectorySorts.Experience, label: 'coaches.filter.sort.experience' },
  { value: CoachDirectorySorts.Name, label: 'coaches.filter.sort.name' },
];

/**
 * The city "Near you" narrows to: the city Discover shows (picked on this
 * phone), else the reader's own, and only one the directory has coaches in,
 * so the chip never opens on an empty list. Null hides the chip. Discover's
 * "Everywhere" is a choice of what to browse, not of where the reader is, so
 * it falls through to their own city.
 */
export function nearYouCity(
  chosen: string | null,
  accountCity: string | null | undefined,
  cities: readonly CoachFacet[],
): string | null {
  const find = (key: string | null) =>
    key ? (cities.find((city) => cityKey(city.label) === key)?.label ?? null) : null;
  return find(chosen === EVERYWHERE ? null : chosen) ?? find(cityKey(accountCity));
}

export interface DirectoryRequest {
  filter: CoachFilterId;
  sheet: CoachSheetFilters;
  /** The term the API searches on: already held back below its floor. */
  query: string;
  /** What "Near you" narrows to; null when the reader has no such city. */
  nearCity: string | null;
  /**
   * Search is open. Its results cover the whole directory: the chips and the
   * sheet fold away with the title, so a filter left on would narrow the
   * results with nothing on screen saying so. Only the sort still applies.
   */
  searching: boolean;
  page: number;
  limit: number;
}

/**
 * The directory request for what is on screen. A city picked in the sheet
 * wins over Near you, which hides while one is applied. Requests is the
 * reader's own short list, which the sheet never narrows (the chip sets the
 * picks aside, as on Yours). Yours is not a directory view; asked for anyway,
 * it reads as All.
 */
export function directoryParams(request: DirectoryRequest): CoachDirectoryParams {
  const { filter, page, limit } = request;
  const chip = request.searching ? CoachFilterIds.All : filter;
  const sheet =
    chip === CoachFilterIds.Requests
      ? NO_SHEET_FILTERS
      : request.searching
        ? { ...NO_SHEET_FILTERS, sort: request.sheet.sort }
        : request.sheet;
  const city = sheet.city ?? (chip === CoachFilterIds.NearYou ? request.nearCity : null);

  return {
    page,
    limit,
    sort: sheet.sort,
    ...(request.query ? { search: request.query } : {}),
    ...(city ? { city } : {}),
    ...(chip === CoachFilterIds.Requests ? { requested: true } : {}),
    ...(chip === CoachFilterIds.Online ? { online: true } : {}),
    ...(sheet.specializations.length > 0 ? { specializations: sheet.specializations } : {}),
    ...(sheet.minYears ? { minYears: sheet.minYears } : {}),
  };
}

/** Whether a request narrows the directory, which a bare first page does not. */
export function narrowsDirectory(params: CoachDirectoryParams): boolean {
  return !!(
    params.search ||
    params.city ||
    params.accepting ||
    params.online ||
    params.requested ||
    params.specializations?.length ||
    params.minYears
  );
}
