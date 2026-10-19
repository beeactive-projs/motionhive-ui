import {
  InstructorClient,
  InstructorClientStatus,
  InstructorClientStatuses,
  clientDisplayName,
  clientEmail,
} from 'core';

/**
 * What the Clients tab is looking at: the one `/clients` list, narrowed by a
 * status chip or by the search field above it.
 */

export const ClientFilterIds = {
  All: 'all',
  Active: 'active',
  Requests: 'requests',
  Archived: 'archived',
} as const;

export type ClientFilterId = (typeof ClientFilterIds)[keyof typeof ClientFilterIds];

export interface ClientFilter {
  id: ClientFilterId;
  /** Translation key — the chip row and the search scope line translate it. */
  label: string;
  /** The server-side status the chip narrows to; none for "All". */
  status?: InstructorClientStatus;
}

/**
 * The quick-filter chips over the client list. "Requests" is the PENDING
 * status: the API folds invitations and incoming requests into one bucket.
 */
export const CLIENT_FILTERS: readonly ClientFilter[] = [
  { id: ClientFilterIds.All, label: 'clients.filters.all' },
  {
    id: ClientFilterIds.Active,
    label: 'clients.filters.active',
    status: InstructorClientStatuses.Active,
  },
  {
    id: ClientFilterIds.Requests,
    label: 'clients.filters.requests',
    status: InstructorClientStatuses.Pending,
  },
  {
    id: ClientFilterIds.Archived,
    label: 'clients.filters.archived',
    status: InstructorClientStatuses.Archived,
  },
];

export function filterStatus(id: ClientFilterId): InstructorClientStatus | undefined {
  return CLIENT_FILTERS.find((filter) => filter.id === id)?.status;
}

/**
 * The query param that opens the tab on a chip: Home's requests banner and a
 * request notification both land on `/tabs/clients?filter=requests`. The
 * notification map in `_shared` spells the same value out, since it may not
 * import from here.
 */
export const CLIENT_FILTER_PARAM = 'filter';

/** The Clients tab, opened on the Requests chip. */
export const CLIENT_REQUESTS_URL = `/tabs/clients?${CLIENT_FILTER_PARAM}=${ClientFilterIds.Requests}`;

/**
 * The chip a Clients tab URL asks for, or null when it asks for none (or for
 * one that does not exist). Only the tab's own root counts: a client page
 * under it carries no chip.
 */
export function filterFromUrl(url: string): ClientFilterId | null {
  const [path, query = ''] = url.split('#')[0].split('?');
  if (path !== '/tabs/clients') return null;
  const value = new URLSearchParams(query).get(CLIENT_FILTER_PARAM);
  return CLIENT_FILTERS.find((filter) => filter.id === value)?.id ?? null;
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
