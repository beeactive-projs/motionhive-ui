import { GroupMember, displayName, foldedIncludes } from 'core';

/**
 * What the Groups hub is looking at, and how each list narrows.
 *
 * The three segments are three different sources — an aggregated post feed,
 * a public directory, and your own memberships — so each has its own search
 * shape. The one box above them has to narrow whichever list is under it.
 */

/** The hub's three lenses, mirroring web's Feed · Discover · Your groups. */
export const GroupsSegments = {
  Feed: 'feed',
  Discover: 'discover',
  Mine: 'mine',
} as const;

export type GroupsSegment = (typeof GroupsSegments)[keyof typeof GroupsSegments];

/** The tabs inside one group. */
export const GroupTabs = {
  Posts: 'posts',
  Members: 'members',
  About: 'about',
} as const;

export type GroupTab = (typeof GroupTabs)[keyof typeof GroupTabs];

/**
 * The shortest term Discover is asked to search on.
 *
 * Unlike the clients directory the API has no floor of its own here, so this
 * is ours: a single character is a request per keystroke for a result set
 * nobody can read. Below it the typed term narrows the loaded rows in memory
 * instead.
 */
export const MIN_SEARCH_LENGTH = 2;

/**
 * Member search. Email is owner-only on screen but searched for everyone who
 * can see it — a term that matches a hidden field and returns nothing looks
 * broken, and a non-owner never has the email to type in the first place.
 */
export function matchesMemberQuery(member: GroupMember, query: string): boolean {
  if (!query.trim()) return true;
  return foldedIncludes(displayName(member.user, ''), query) || foldedIncludes(member.user?.email, query);
}
