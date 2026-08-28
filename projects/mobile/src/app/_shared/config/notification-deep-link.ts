import { NotificationData } from 'core';

/**
 * Where a notification opens on mobile.
 *
 * The backend emits web routes (`profile/invoices`, `coaching/payments`, …)
 * because that is where the product started. Most of them have no mobile
 * screen yet, so these maps are the single place that knows which do — and a
 * row's chevron is decided by whether the lookup succeeds.
 *
 * Shared config rather than part of the centre: the arrival banner asks the
 * same question from outside the feature ("does this open where I already
 * am?"), and `_shared` must not reach into `main/`.
 *
 * Adding a screen later means moving one line from `NOT_ON_MOBILE` to
 * `SCREEN_ROUTES`; nothing else changes.
 */

/** Router commands, plus the query params the resolver did not consume. */
export interface DeepLink {
  commands: string[];
  queryParams: Record<string, string> | null;
}

type Params = Record<string, string>;

function link(commands: string[], rest: Params = {}): DeepLink {
  return { commands, queryParams: Object.keys(rest).length > 0 ? rest : null };
}

const params = (d: NotificationData): Params => d.queryParams ?? {};

/**
 * `sessions` / `user/sessions` go to the person who booked — the trainee
 * surface, deliberately a different route from the coach's guarded agenda.
 * The backend's two spellings are historical; both mean the same screen.
 *
 * A cancelled or declined booking names its own list through `tab`, which is
 * consumed here rather than forwarded to a page that would ignore it.
 */
const traineeSessions = (d: NotificationData): DeepLink => {
  const { tab, ...rest } = params(d);
  if (tab === 'cancelled') return link(['/tabs/user/sessions/cancelled'], rest);
  return link(
    d.entityId ? ['/tabs/user/sessions', d.entityId] : ['/tabs/user/sessions'],
    params(d),
  );
};

const SCREEN_ROUTES: Record<string, (data: NotificationData) => DeepLink> = {
  // The backend names the conversation in `queryParams.conversationId`, the
  // way the web inbox reads it. Here it is the route segment.
  messages: (d) => {
    const { conversationId, ...rest } = params(d);
    const id = conversationId ?? d.entityId;
    return link(id ? ['/tabs/messages', id] : ['/tabs/messages'], rest);
  },
  // The coaching screens only ever go to instructors, which is what the
  // `/tabs/coach/sessions` and `/tabs/clients` guards require.
  'coaching/sessions': (d) =>
    link(
      d.entityId ? ['/tabs/coach/sessions', d.entityId] : ['/tabs/coach/sessions'],
      params(d),
    ),
  'coaching/clients': (d) => link(['/tabs/clients'], params(d)),
  'coaching/pending-requests': (d) => link(['/tabs/clients/requests'], params(d)),
  // Payments, both sides. The coach's screens are guarded; the client's are
  // not, which matches who each alert goes to.
  'coaching/invoices': (d) =>
    link(
      d.entityId ? ['/tabs/home/payments', d.entityId] : ['/tabs/home/payments'],
      params(d),
    ),
  'coaching/payments': (d) => link(['/tabs/home/payments'], params(d)),
  'profile/invoices': (d) =>
    link(d.entityId ? ['/tabs/home/billing', d.entityId] : ['/tabs/home/billing'], params(d)),
  sessions: traineeSessions,
  'user/sessions': traineeSessions,
};

/**
 * Everything else the server can point at, and what to call it.
 *
 * Kept explicit rather than inferred so the detail sheet can name the real
 * destination — and so an unrecognised screen stays visibly different from a
 * known-but-unbuilt one. `notification-deep-link.spec.ts` checks this covers
 * every screen the API emits.
 */
const NOT_ON_MOBILE: Record<string, string> = {
  groups: 'Groups',
  'user/plans': 'My plans',
  'coaching/exercises': 'Exercises',
  // Subscriptions a coach *sells* stay on the web; the client's own
  // memberships are a segment on their billing screen.
  'coaching/subscriptions': 'Memberships',
};

/**
 * `screen: 'profile'` always carries the tab that holds the thing being talked
 * about, so the tab is what names it — "your profile" would be wrong for all
 * three.
 */
const PROFILE_TABS: Record<string, string> = {
  coaches: 'Coaches',
};

/**
 * `screen: 'profile'` with a billing tab is really a billing link — the web
 * keeps invoices and memberships behind profile tabs, mobile gives them their
 * own screen with a segment.
 */
const PROFILE_TAB_ROUTES: Record<string, string[]> = {
  memberships: ['/tabs/home/billing'],
  invoices: ['/tabs/home/billing'],
};

/** The resolved link, or null when the notification has nowhere to go. */
export function resolveDeepLink(data: NotificationData | null): DeepLink | null {
  if (!data?.screen) return null;
  if (data.screen === 'profile') {
    const commands = PROFILE_TAB_ROUTES[data.queryParams?.['tab'] ?? ''];
    return commands ? link(commands, params(data)) : null;
  }
  return SCREEN_ROUTES[data.screen]?.(data) ?? null;
}

/** Router commands for this notification, or null when it has nowhere to go. */
export function routeFor(data: NotificationData | null): string[] | null {
  return resolveDeepLink(data)?.commands ?? null;
}

/** Query params to carry along — the ones the route itself did not consume. */
export function queryParamsFor(data: NotificationData | null): Params | null {
  return resolveDeepLink(data)?.queryParams ?? null;
}

/**
 * Where this lives instead, for the detail sheet's footnote. Null when the
 * screen is simply unknown — then the sheet says nothing rather than promising
 * a page that may not exist on the web either.
 */
export function webOnlyLabel(data: NotificationData | null): string | null {
  if (!data?.screen) return null;
  if (data.screen === 'profile') {
    return PROFILE_TABS[data.queryParams?.['tab'] ?? ''] ?? null;
  }
  return NOT_ON_MOBILE[data.screen] ?? null;
}

/**
 * Whether `url` already shows the screen this notification opens — then there
 * is nothing to announce. Segment-aware: a page under the target counts (the
 * sessions area is "there" for a list-level alert), a sibling that merely
 * shares the prefix does not, and the list is not the booking.
 */
export function isOnTarget(url: string, data: NotificationData | null): boolean {
  const commands = routeFor(data);
  if (!commands) return false;
  const path = url.split(/[?#]/)[0] ?? '';
  const target = commands.join('/');
  return path === target || path.startsWith(`${target}/`);
}

/** Exported for the spec that checks both maps against the server's screens. */
export const KNOWN_SCREENS = {
  routed: [...Object.keys(SCREEN_ROUTES), 'profile'],
  named: Object.keys(NOT_ON_MOBILE),
};
