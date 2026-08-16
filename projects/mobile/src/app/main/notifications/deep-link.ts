import { NotificationData } from 'core';

/**
 * Where a notification opens on mobile.
 *
 * The backend emits web routes (`profile/invoices`, `coaching/payments`, …)
 * because that is where the product started. Most of them have no mobile
 * screen yet, so these two maps are the single place that knows which do — and
 * a row's chevron is decided by whether the lookup succeeds.
 *
 * Adding a screen later means moving one line from `NOT_ON_MOBILE` to
 * `SCREEN_ROUTES`; nothing else changes.
 */
const SCREEN_ROUTES: Record<string, (data: NotificationData) => string[]> = {
  messages: (d) => (d.entityId ? ['/tabs/messages', d.entityId] : ['/tabs/messages']),
  // The coaching screens only ever go to instructors, which is what the
  // `/tabs/sessions` and `/tabs/clients` guards require.
  'coaching/sessions': (d) =>
    d.entityId ? ['/tabs/sessions', d.entityId] : ['/tabs/sessions'],
  'coaching/clients': () => ['/tabs/clients'],
  'coaching/pending-requests': () => ['/tabs/clients/requests'],
};

/**
 * Everything else the server can point at, and what to call it.
 *
 * Kept explicit rather than inferred so the detail sheet can name the real
 * destination — and so an unrecognised screen stays visibly different from a
 * known-but-unbuilt one. `deep-link.spec.ts` checks this covers every screen
 * the API emits.
 *
 * Note `sessions` (not `coaching/sessions`): that one goes to the person who
 * booked, and a trainee has no session screen here. Routing it to the coach's
 * would bounce them off the instructor guard, which is worse than opening the
 * detail sheet.
 */
const NOT_ON_MOBILE: Record<string, string> = {
  groups: 'Groups',
  sessions: 'My sessions',
  'user/sessions': 'My sessions',
  'user/plans': 'My plans',
  'coaching/exercises': 'Exercises',
  'profile/invoices': 'Payments',
  'coaching/invoices': 'Payments',
  'coaching/payments': 'Payments',
  'coaching/subscriptions': 'Memberships',
};

/**
 * `screen: 'profile'` always carries the tab that holds the thing being talked
 * about, so the tab is what names it — "your profile" would be wrong for all
 * three.
 */
const PROFILE_TABS: Record<string, string> = {
  memberships: 'Memberships',
  invoices: 'Invoices',
  coaches: 'Coaches',
};

/** Router commands for this notification, or null when it has nowhere to go. */
export function routeFor(data: NotificationData | null): string[] | null {
  if (!data?.screen) return null;
  return SCREEN_ROUTES[data.screen]?.(data) ?? null;
}

/** Query params to carry along, if the notification asked for any. */
export function queryParamsFor(data: NotificationData | null): Record<string, string> | null {
  return data?.queryParams ?? null;
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

/** Exported for the spec that checks both maps against the server's screens. */
export const KNOWN_SCREENS = {
  routed: Object.keys(SCREEN_ROUTES),
  named: [...Object.keys(NOT_ON_MOBILE), 'profile'],
};
