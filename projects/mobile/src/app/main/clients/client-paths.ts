import { inject } from '@angular/core';
import { RedirectFunction, Router } from '@angular/router';

/**
 * Where the client screens live.
 *
 * A client is reached from two tabs: Clients, from the person, and Programs,
 * from a plan's list of who is on it. Back returns to origin, so the client
 * page and everything it opens (an exercise's progress, a logged workout,
 * the public profile) are mounted in both stacks, and every link out of
 * them stays in whichever one the URL is in. Pushing onto the other tab left
 * back with nothing to pop.
 *
 *   Clients:  /tabs/clients/:clientId          ?tab=, …/progress/:exerciseId
 *   Programs: /tabs/programs/client/:clientId  ?tab=, …/progress/:exerciseId
 *   Both:     <stack>/log/:id, <stack>/person/:handle
 *
 * Training and Progress used to be pages of their own (…/training,
 * …/progress); they are tabs of the client page now, and those addresses
 * redirect there so old links and notifications still land.
 */
export const CoachStacks = {
  Clients: '/tabs/clients',
  Programs: '/tabs/programs',
} as const;

export type CoachStack = (typeof CoachStacks)[keyof typeof CoachStacks];

/** The two tabs that were pages, as their old addresses name them. */
export type FormerClientPage = 'training' | 'progress';

export function coachStackOf(url: string): CoachStack {
  return url.startsWith(CoachStacks.Programs) ? CoachStacks.Programs : CoachStacks.Clients;
}

/**
 * The invite page. Only the Clients stack has one: it is reached from that
 * tab's header and its empty state, and inviting from a plan's roster would
 * leave back with nothing to pop.
 */
export const CLIENT_INVITE_PATH = `${CoachStacks.Clients}/invite`;

/** The client page's own path, as router commands. */
export function clientPath(stack: CoachStack, clientId: string): string[] {
  return stack === CoachStacks.Programs ? [stack, 'client', clientId] : [stack, clientId];
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
