/**
 * Global search — request/response contract.
 *
 * Backend: `GET /search?q=...&type=all&limit=10&cursor=...`
 * (See `docs/research/search/recommendations.md` in the API repo for
 * the rationale behind cursor pagination and the heterogeneous shape.)
 *
 * Endpoint does NOT exist yet — the FE renders empty state on 404 so
 * the UX still works while the BE catches up.
 */

export type SearchEntityType = 'all' | 'people' | 'instructors' | 'groups' | 'sessions' | 'tags';

export type SearchResultType = 'instructor' | 'group' | 'session' | 'tag' | 'user';

export interface SearchResultItem {
  type: SearchResultType;
  id: string;
  /** Primary line — usually the entity's display name. */
  title: string;
  /** Secondary line — role/specializations/member count/etc. */
  subtitle?: string | null;
  /** Avatar/cover image URL. Optional; the modal falls back to initials/icons. */
  avatarUrl?: string | null;
  /** 0..1 relevance score. Useful for FE A/B presentation; can be ignored. */
  score?: number;
  /** Field paths that matched, e.g. ["specializations", "displayName"].
   *  Lets the modal highlight the matched substring without re-running
   *  the match itself. */
  matchedFields?: string[];
  /** For tags: extra metadata so the row can show "324 sessions · 18 groups". */
  meta?: Record<string, string | number> | null;
}

export interface SearchCategoryResult {
  items: SearchResultItem[];
  /** Total matches in this category before the limit. Drives "See all 24". */
  total: number;
  /** Opaque cursor for the next page; null when fully loaded. */
  nextCursor: string | null;
}

export interface SearchResponse {
  query: string;
  /** Server-side latency, milliseconds. */
  tookMs: number;
  byCategory: {
    instructors: SearchCategoryResult;
    groups: SearchCategoryResult;
    sessions: SearchCategoryResult;
    tags: SearchCategoryResult;
    users: SearchCategoryResult;
  };
}

export interface SearchQueryParams {
  q: string;
  type?: SearchEntityType;
  /** Per-category cap. Default 10 server-side. */
  limit?: number;
  cursor?: string;
}
