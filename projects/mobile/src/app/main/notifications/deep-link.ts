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
  // `/tabs/coach/sessions` and `/tabs/clients` guards require.
  'coaching/sessions': (d) =>
    d.entityId ? ['/tabs/coach/sessions', d.entityId] : ['/tabs/coach/sessions'],
  'coaching/clients': () => ['/tabs/clients'],
  'coaching/pending-requests': () => ['/tabs/clients/requests'],
  // Payments, both sides. The coach's screens are guarded; the client's are
  // not, which matches who each alert goes to.
  'coaching/invoices': (d) =>
    d.entityId ? ['/tabs/home/payments', d.entityId] : ['/tabs/home/payments'],
  'coaching/payments': () => ['/tabs/home/payments'],
  'profile/invoices': (d) =>
    d.entityId ? ['/tabs/home/billing', d.entityId] : ['/tabs/home/billing'],
  // `sessions` / `user/sessions` go to the person who booked — the trainee
  // surface, deliberately a different route from the coach's guarded agenda.
  // The backend's two spellings are historical; both mean the same screen.
  sessions: (d) =>
    d.entityId ? ['/tabs/user/sessions', d.entityId] : ['/tabs/user/sessions'],
  'user/sessions': (d) =>
    d.entityId ? ['/tabs/user/sessions', d.entityId] : ['/tabs/user/sessions'],
};

/**
 * Everything else the server can point at, and what to call it.
 *
 * Kept explicit rather than inferred so the detail sheet can name the real
 * destination — and so an unrecognised screen stays visibly different from a
 * known-but-unbuilt one. `deep-link.spec.ts` checks this covers every screen
 * the API emits.
 *
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

/** Router commands for this notification, or null when it has nowhere to go. */
export function routeFor(data: NotificationData | null): string[] | null {
  if (!data?.screen) return null;
  if (data.screen === 'profile') {
    return PROFILE_TAB_ROUTES[data.queryParams?.['tab'] ?? ''] ?? null;
  }
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
  routed: [...Object.keys(SCREEN_ROUTES), 'profile'],
  named: Object.keys(NOT_ON_MOBILE),
};
