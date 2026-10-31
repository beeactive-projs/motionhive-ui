import { inject } from '@angular/core';
import { RedirectFunction, Router } from '@angular/router';

/**
 * Where the client screens live.
 *
 * A client is reached from three tabs: Clients, from the person; Programs,
 * from a plan's list of who is on it; and Home, from Needs you. Back returns
 * to origin, so the client page and everything it opens (an exercise's
 * progress, a logged workout, a session, a plan, the public profile) are
 * mounted in every one of those stacks, and every link out of them stays in
 * whichever one the URL is in. Pushing onto the other tab left back with
 * nothing to pop.
 *
 *   Clients:  /tabs/clients/:clientId          ?tab=, …/progress/:exerciseId
 *   Programs: /tabs/programs/client/:clientId  ?tab=, …/progress/:exerciseId
 *   Home:     /tabs/home/client/:clientId      ?tab=, …/progress/:exerciseId
 *   All:      <stack>/log/:id, <stack>/session/:id, <stack>/program/:id,
 *             <stack>/person/:handle
 *
 * Training and Progress used to be pages of their own (…/training,
 * …/progress); they are tabs of the client page now, and those addresses
 * redirect there so old links and notifications still land.
 */
export const CoachStacks = {
  Clients: '/tabs/clients',
  Programs: '/tabs/programs',
  Home: '/tabs/home',
} as const;

export type CoachStack = (typeof CoachStacks)[keyof typeof CoachStacks];

/** The two tabs that were pages, as their old addresses name them. */
export type FormerClientPage = 'training' | 'progress';

/** True when the URL is the stack's root or a page pushed onto it. */
function isIn(url: string, stack: CoachStack): boolean {
  const path = url.split(/[?#]/)[0];
  return path === stack || path.startsWith(`${stack}/`);
}

/** The stack a URL is in; anywhere else (a cold load) is the Clients tab. */
export function coachStackOf(url: string): CoachStack {
  if (isIn(url, CoachStacks.Programs)) return CoachStacks.Programs;
  if (isIn(url, CoachStacks.Home)) return CoachStacks.Home;
  return CoachStacks.Clients;
}

/**
 * The invite page. Only the Clients stack has one: it is reached from that
 * tab's header and its empty state, and inviting from a plan's roster would
 * leave back with nothing to pop.
 */
export const CLIENT_INVITE_PATH = `${CoachStacks.Clients}/invite`;

/**
 * The client page's own path, as router commands. The Clients tab mounts it
 * at its root; the other stacks under `client/`, beside their own pages.
 */
export function clientPath(stack: CoachStack, clientId: string): string[] {
  return stack === CoachStacks.Clients ? [stack, clientId] : [stack, 'client', clientId];
}

/** The same path as one string, for an `ion-back-button` fallback. */
export function clientUrl(stack: CoachStack, clientId: string): string {
  return clientPath(stack, clientId).join('/');
}

/**
 * A redirect from a former page (`…/training`, `…/progress`) to the client
 * page open on that tab, in the same stack.
 */
export function clientTabRedirect(stack: CoachStack, tab: FormerClientPage): RedirectFunction {
  return ({ params }) =>
    inject(Router).createUrlTree(clientPath(stack, String(params['clientId'] ?? '')), {
      queryParams: { tab },
    });
}
