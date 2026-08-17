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
      '/tabs/sessions',
      'abc',
    ]);
  });

  // A trainee's booking alert must never land on the coach's agenda: that
  // route is behind an instructor guard, so the tap would bounce silently.
  it('routes a trainee session alert to their own sessions, not the coach agenda', () => {
    expect(routeFor({ screen: 'sessions', entityId: 'abc' })).toEqual([
      '/tabs/sessions',
      'abc',
    ]);
    expect(routeFor({ screen: 'user/sessions' })).toEqual(['/tabs/sessions']);
  });

  // Both roles share the address; a `canMatch` on mode decides which screen
  // answers, so the deep link does not need to know who is asking.
  it('sends both roles to the same session address', () => {
    expect(routeFor({ screen: 'sessions', entityId: 'abc' })).toEqual(
      routeFor({ screen: 'coaching/sessions', entityId: 'abc' }),
    );
  });

  // A program assignment is the alert most likely to be tapped by a trainee,
  // and it was the one falling through the map.
  it('names the plan screen a program assignment points at', () => {
    expect(routeFor({ screen: 'user/plans', entityId: 'a-1' })).toBeNull();
    expect(webOnlyLabel({ screen: 'user/plans', entityId: 'a-1' })).toBe('My plans');
  });

  // The web keeps invoices and memberships behind profile tabs; mobile gives
  // them a screen, so those two route and the rest still only get a name.
  it('routes the billing profile tabs and names the ones with no screen', () => {
    expect(routeFor({ screen: 'profile', queryParams: { tab: 'invoices' } })).toEqual([
      '/tabs/home/billing',
    ]);
    expect(routeFor({ screen: 'profile', queryParams: { tab: 'memberships' } })).toEqual([
      '/tabs/home/billing',
    ]);
    expect(routeFor({ screen: 'profile', queryParams: { tab: 'coaches' } })).toBeNull();
    expect(webOnlyLabel({ screen: 'profile', queryParams: { tab: 'coaches' } })).toBe('Coaches');
    // No tab means we cannot say what it is about, so we say nothing.
    expect(webOnlyLabel({ screen: 'profile' })).toBeNull();
  });

  // Both sides of an invoice alert land on the right person's screen.
  it('sends invoice alerts to the side that received them', () => {
    expect(routeFor({ screen: 'coaching/invoices', entityId: 'inv-1' })).toEqual([
      '/tabs/home/payments',
      'inv-1',
    ]);
    expect(routeFor({ screen: 'profile/invoices', entityId: 'inv-1' })).toEqual([
      '/tabs/home/billing',
      'inv-1',
    ]);
  });

  it('says nothing about a screen it has never heard of', () => {
    expect(routeFor({ screen: 'something/new' })).toBeNull();
    expect(webOnlyLabel({ screen: 'something/new' })).toBeNull();
    expect(routeFor(null)).toBeNull();
  });
});
