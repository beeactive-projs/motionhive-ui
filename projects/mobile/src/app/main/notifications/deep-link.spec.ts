import { describe, expect, it } from 'vitest';

import { KNOWN_SCREENS, routeFor, webOnlyLabel } from './deep-link';

/**
 * Every `data.screen` the API emits, taken from the builder files themselves —
 * *not* from a grep over the whole backend, which is how four screens that
 * only exist in test fixtures (`invoice`, `my-invoices`, `my/sessions`,
 * `my/plans`) got into this list once, while the real `user/plans` was missed
 * and program-assignment alerts silently lost their footnote.
 *
 * Copied rather than imported — the API is a separate repo, and it keeps the
 * mirror of this check in `notification-targets.spec.ts`. When a new type
 * ships, this fails until the screen is either routed or named, so a new alert
 * can never quietly become a row that does nothing.
 */
const SCREENS_THE_API_EMITS = [
  'groups',
  'profile',
  'profile/invoices',
  'coaching/payments',
  'sessions',
  'coaching/invoices',
  'coaching/clients',
  'messages',
  'coaching/sessions',
  'user/sessions',
  'user/plans',
  'coaching/subscriptions',
  'coaching/pending-requests',
  'coaching/exercises',
];

describe('deep links', () => {
  it('accounts for every screen the API can send', () => {
    const known = new Set([...KNOWN_SCREENS.routed, ...KNOWN_SCREENS.named]);
    for (const screen of SCREENS_THE_API_EMITS) {
      expect(known, `${screen} is neither routed nor named`).toContain(screen);
    }
  });

  it('never claims a screen both ways', () => {
    for (const screen of KNOWN_SCREENS.routed) {
      expect(KNOWN_SCREENS.named).not.toContain(screen);
    }
  });

  it('routes a coach session alert to that session', () => {
    expect(routeFor({ screen: 'coaching/sessions', entityId: 'abc' })).toEqual([
      '/tabs/coach/sessions',
      'abc',
    ]);
  });

  // A trainee's booking alert lands on the trainee surface, never the coach's
  // — the instructor guard would bounce a non-coach and the tap would do
  // nothing visible. Both of the backend's spellings mean the same screen.
  it('routes a trainee session alert to the trainee area', () => {
    expect(routeFor({ screen: 'sessions', entityId: 'abc' })).toEqual([
      '/tabs/user/sessions',
      'abc',
    ]);
    expect(routeFor({ screen: 'user/sessions', entityId: 'abc' })).toEqual([
      '/tabs/user/sessions',
      'abc',
    ]);
    expect(routeFor({ screen: 'sessions' })).toEqual(['/tabs/user/sessions']);
  });

  // A program assignment is the alert most likely to be tapped by a trainee,
  // and it was the one falling through the map.
  it('names the plan screen a program assignment points at', () => {
    expect(routeFor({ screen: 'user/plans', entityId: 'a-1' })).toBeNull();
    expect(webOnlyLabel({ screen: 'user/plans', entityId: 'a-1' })).toBe('My plans');
  });

  it('names the profile tab rather than the profile', () => {
    expect(webOnlyLabel({ screen: 'profile', queryParams: { tab: 'memberships' } })).toBe(
      'Memberships',
    );
    expect(webOnlyLabel({ screen: 'profile', queryParams: { tab: 'coaches' } })).toBe('Coaches');
    // No tab means we cannot say what it is about, so we say nothing.
    expect(webOnlyLabel({ screen: 'profile' })).toBeNull();
  });

  it('says nothing about a screen it has never heard of', () => {
    expect(routeFor({ screen: 'something/new' })).toBeNull();
    expect(webOnlyLabel({ screen: 'something/new' })).toBeNull();
    expect(routeFor(null)).toBeNull();
  });
});
