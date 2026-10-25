/**
 * The people a search ended on, kept on the device so the next search can
 * open on them, as Messenger's does.
 *
 * A recent is a person, not the text that was typed: every result on these
 * screens is a person, so a row that opens Ana beats one that types "an"
 * back in. The snapshot is what the row draws (name, avatar, the line under
 * it); the screen re-reads the person from the server when it opens.
 */
export interface RecentPerson {
  /** The person's user id. */
  id: string;
  name: string;
  avatarUrl: string | null;
  /** The second line: an email, a handle. Null shows the name alone. */
  subline: string | null;
}

/**
 * Someone in a suggestion strip. A suggestion can be a person the screen
 * cannot open yet (a client invitation still waiting): it carries the status
 * word, which is said with the name and tells the page where a tap goes.
 */
export interface SuggestedPerson extends RecentPerson {
  /** Translated status ("Invited", "Request"). Set only while it is waiting. */
  pendingLabel?: string | null;
  /** A tile glyph in place of the avatar, for someone with no account yet. */
  icon?: string | null;
}

/** One labelled row of people under the recents. */
export interface SuggestionStrip {
  /** Translated: "Pending requests", "Newest clients". */
  label: string;
  people: SuggestedPerson[];
}

/** Each screen keeps its own list. */
export const RecentSearchScopes = {
  Messages: 'messages',
  Clients: 'clients',
} as const;

export type RecentSearchScope = (typeof RecentSearchScopes)[keyof typeof RecentSearchScopes];

/** Messenger keeps a longer run; three fit above the suggestions without scrolling. */
export const RECENT_SEARCH_LIMIT = 3;

/** How many people a suggestion strip, or a suggestion list of rows, offers. */
export const SUGGESTION_LIMIT = 8;

/** Newest first, one entry per person, capped. */
export function pushRecent(
  list: readonly RecentPerson[],
  entry: RecentPerson,
  limit = RECENT_SEARCH_LIMIT,
): RecentPerson[] {
  return [entry, ...list.filter((person) => person.id !== entry.id)].slice(0, limit);
}

export function removeRecent(list: readonly RecentPerson[], id: string): RecentPerson[] {
  return list.filter((person) => person.id !== id);
}

/**
 * Whatever storage hands back, as a list the rows can draw. Anything that is
 * not a well-formed entry is dropped rather than failing the whole list: a
 * shortcut that loses one row is still a shortcut.
 */
export function parseRecents(raw: unknown): RecentPerson[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecentPerson).slice(0, RECENT_SEARCH_LIMIT);
}

function isRecentPerson(value: unknown): value is RecentPerson {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry['id'] === 'string' &&
    typeof entry['name'] === 'string' &&
    (entry['avatarUrl'] === null || typeof entry['avatarUrl'] === 'string') &&
    (entry['subline'] === null || typeof entry['subline'] === 'string')
  );
}
