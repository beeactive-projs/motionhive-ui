import {
  InstructorClient,
  InstructorClientStatus,
  InstructorClientStatuses,
  RosterClient,
  clientDisplayName,
  clientEmail,
} from 'core';

/**
 * What the Clients tab is looking at: which lens, narrowed by which chip, and
 * narrowed again by the search box above both.
 */

/** The two lenses on the same people: who needs a nudge, and everyone. */
export const ClientsSegments = {
  Attention: 'attention',
  All: 'all',
} as const;

export type ClientsSegment = (typeof ClientsSegments)[keyof typeof ClientsSegments];

export const ClientFilterIds = {
  All: 'all',
  Active: 'active',
  Requests: 'requests',
  Archived: 'archived',
} as const;

export type ClientFilterId = (typeof ClientFilterIds)[keyof typeof ClientFilterIds];

export interface ClientFilter {
  id: ClientFilterId;
  label: string;
  /** The server-side status the chip narrows to; none for "All". */
  status?: InstructorClientStatus;
}

/**
 * The quick-filter chips over the All clients list. "Requests" is the PENDING
 * status: the API folds invitations and incoming requests into one bucket.
 */
export const CLIENT_FILTERS: readonly ClientFilter[] = [
  { id: ClientFilterIds.All, label: 'All' },
  { id: ClientFilterIds.Active, label: 'Active', status: InstructorClientStatuses.Active },
  { id: ClientFilterIds.Requests, label: 'Requests', status: InstructorClientStatuses.Pending },
  { id: ClientFilterIds.Archived, label: 'Archived', status: InstructorClientStatuses.Archived },
];

export function filterStatus(id: ClientFilterId): InstructorClientStatus | undefined {
  return CLIENT_FILTERS.find((filter) => filter.id === id)?.status;
}

/**
 * The shortest term the API will actually search on — anything below this it
 * ignores, answering with the unfiltered page.
 *
 * That answer is indistinguishable from a match, which is how a single `a`
 * came back as the whole directory under a search box reading "a". The
 * directory holds a shorter term back and narrows in memory instead, and says
 * so under the field. Same floor as the invite sheet's people search.
 */
export const MIN_SEARCH_LENGTH = 2;

/** Header search over the loaded rows: name or email, case-insensitive. */
export function matchesClientQuery(client: InstructorClient, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return (
    clientDisplayName(client).toLowerCase().includes(term) ||
    clientEmail(client).toLowerCase().includes(term)
  );
}

/**
 * The same search over a roster row. The roster is a different shape from a
 * relationship — a name and a handle, no email — so it needs its own
 * predicate, but the search box above the two segments is one box and has to
 * narrow whichever list is under it.
 */
export function matchesRosterQuery(client: RosterClient, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return (
    client.name.toLowerCase().includes(term) ||
    (client.handle?.toLowerCase().includes(term) ?? false)
  );
}
