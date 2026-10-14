/**
 * Where the client screens live.
 *
 * A client is reached from two tabs: Clients, from the person, and Programs,
 * from a plan's list of who is on it. Back returns to origin, so the client
 * page and everything it opens (training, progress, a logged workout, the
 * public profile) are mounted in both stacks, and every link out of them
 * stays in whichever one the URL is in. Pushing onto the other tab left back
 * with nothing to pop.
 *
 *   Clients:  /tabs/clients/:clientId          …/training, …/progress
 *   Programs: /tabs/programs/client/:clientId  …/training, …/progress
 *   Both:     <stack>/log/:id, <stack>/person/:handle
 */
export const CoachStacks = {
  Clients: '/tabs/clients',
  Programs: '/tabs/programs',
} as const;

export type CoachStack = (typeof CoachStacks)[keyof typeof CoachStacks];

export function coachStackOf(url: string): CoachStack {
  return url.startsWith(CoachStacks.Programs) ? CoachStacks.Programs : CoachStacks.Clients;
}

/** The client page's own path, as router commands. */
export function clientPath(stack: CoachStack, clientId: string): string[] {
  return stack === CoachStacks.Programs ? [stack, 'client', clientId] : [stack, clientId];
}

/** The same path as one string, for an `ion-back-button` fallback. */
export function clientUrl(stack: CoachStack, clientId: string): string {
  return clientPath(stack, clientId).join('/');
}
