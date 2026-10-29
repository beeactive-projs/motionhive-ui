/**
 * Where a screen opened from a profile lives.
 *
 * A tab keeps its own back stack, and Ionic cannot pop across tabs: a page
 * pushed onto another tab leaves back with only that tab's list behind it.
 * So the screens a profile opens (the chat with them, a group you share)
 * are mounted in every stack that mounts the profile (`person.routes.ts`),
 * and their links are built from the stack their URL is in:
 *
 *   Messages:  /tabs/messages/:id          the tab's own chat
 *   elsewhere: <stack>/chat/:id
 *   Groups:    /tabs/groups/:groupId       the tab's own group pages
 *   elsewhere: <stack>/groups/:groupId     (`group/` is Discover's preview)
 *
 * A screen whose stack mounts none of them (Home) falls back to the tabs.
 */
export const ProfileStacks = {
  Messages: '/tabs/messages',
  Groups: '/tabs/groups',
  Clients: '/tabs/clients',
  Programs: '/tabs/programs',
  Discover: '/tabs/discover',
  CoachSessions: '/tabs/coach/sessions',
  UserSessions: '/tabs/user/sessions',
  Account: '/tabs/more/account',
  Coaches: '/tabs/more/coaches',
} as const;

const ROOTS: readonly string[] = Object.values(ProfileStacks);

/** The stack a URL is in, or null when it is in none that mounts a profile. */
export function stackRootOf(url: string): string | null {
  const path = url.split(/[?#]/)[0];
  return (
    ROOTS.filter((root) => path === root || path.startsWith(`${root}/`)).sort(
      (a, b) => b.length - a.length,
    )[0] ?? null
  );
}

/** Where chats open from this stack. */
export function chatBase(root: string | null): string {
  return !root || root === ProfileStacks.Messages ? ProfileStacks.Messages : `${root}/chat`;
}

/** Where group pages open from this stack. */
export function groupBase(root: string | null): string {
  return !root || root === ProfileStacks.Groups ? ProfileStacks.Groups : `${root}/groups`;
}

/** The profile in this stack; the Groups tab's own when there is none. */
export function personBase(root: string | null): string {
  return `${root ?? ProfileStacks.Groups}/person`;
}

/**
 * A group page's links, from the stack its URL is in. Outside the Groups
 * tab, an exit (leaving the group, deleting it or a post) goes back towards
 * the screen that opened it rather than to a Groups list it never came from.
 */
export function groupLinks(url: string) {
  const root = stackRootOf(url);
  const base = groupBase(root);
  const inGroupsTab = base === ProfileStacks.Groups;
  return {
    inGroupsTab,
    /** Back on a cold load: the Groups list, or the stack's own root. */
    home: inGroupsTab ? ProfileStacks.Groups : (root ?? ProfileStacks.Groups),
    group: (groupId: string, ...rest: string[]) => [base, groupId, ...rest],
    post: (postId: string, ...rest: string[]) => [base, 'post', postId, ...rest],
    preview: (groupId: string) => [base, 'preview', groupId],
    person: (handle: string, ...rest: string[]) => [personBase(root), handle, ...rest],
  };
}
