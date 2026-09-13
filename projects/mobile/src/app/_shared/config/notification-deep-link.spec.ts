import { describe, expect, it } from 'vitest';

import {
  KNOWN_SCREENS,
  isOnTarget,
  queryParamsFor,
  routeFor,
  webOnlyLabel,
} from './notification-deep-link';

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
  // — that route is behind an instructor guard, so the tap would bounce
  // silently. Both of the backend's spellings mean the same screen.
  it('routes a trainee session alert to their own sessions, not the coach agenda', () => {
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

  // A cancelled or declined booking has its own list, and the tab param that
  // names it is consumed rather than handed to a page that would ignore it.
  it('routes a cancelled booking alert to the cancelled list', () => {
    const data = { screen: 'user/sessions', queryParams: { tab: 'cancelled' } };
    expect(routeFor(data)).toEqual(['/tabs/user/sessions/cancelled']);
    expect(queryParamsFor(data)).toBeNull();
    expect(routeFor({ screen: 'sessions', queryParams: { tab: 'cancelled' } })).toEqual([
      '/tabs/user/sessions/cancelled',
    ]);
  });

  // The backend names the conversation in the query, the way the web inbox
  // reads it; on mobile it is the route segment.
  it('opens a message alert in its conversation', () => {
    const data = { screen: 'messages', queryParams: { conversationId: 'c-1' } };
    expect(routeFor(data)).toEqual(['/tabs/messages', 'c-1']);
    expect(queryParamsFor(data)).toBeNull();
    expect(routeFor({ screen: 'messages', entityId: 'c-2' })).toEqual(['/tabs/messages', 'c-2']);
    expect(routeFor({ screen: 'messages' })).toEqual(['/tabs/messages']);
    expect(
      queryParamsFor({ screen: 'messages', queryParams: { conversationId: 'c-1', foo: 'bar' } }),
    ).toEqual({ foo: 'bar' });
  });

  it('forwards the params it does not consume', () => {
    expect(queryParamsFor({ screen: 'profile', queryParams: { tab: 'invoices' } })).toEqual({
      tab: 'invoices',
    });
    expect(queryParamsFor({ screen: 'coaching/payments' })).toBeNull();
    expect(queryParamsFor({ screen: 'groups', queryParams: { x: '1' } })).toBeNull();
  });

  // The two roles read the same invoice from opposite sides, so the alert has
  // to pick the screen that matches who it was sent to.
  it('splits invoice alerts by side of the bill', () => {
    expect(routeFor({ screen: 'coaching/invoices', entityId: 'inv-1' })).toEqual([
      '/tabs/home/payments',
      'inv-1',
    ]);
    expect(routeFor({ screen: 'profile/invoices', entityId: 'inv-1' })).toEqual([
      '/tabs/home/billing',
      'inv-1',
    ]);
    expect(routeFor({ screen: 'coaching/payments' })).toEqual(['/tabs/home/payments']);
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

  it('says nothing about a screen it has never heard of', () => {
    expect(routeFor({ screen: 'something/new' })).toBeNull();
    expect(webOnlyLabel({ screen: 'something/new' })).toBeNull();
    expect(routeFor(null)).toBeNull();
  });
});

describe('isOnTarget', () => {
  const clients = { screen: 'coaching/clients' };

  it('is true on the exact screen and anywhere under it', () => {
    expect(isOnTarget('/tabs/clients', clients)).toBe(true);
    expect(isOnTarget('/tabs/clients/requests', clients)).toBe(true);
    expect(isOnTarget('/tabs/clients?open=1', clients)).toBe(true);
  });

  it('is false on a sibling that merely shares the prefix', () => {
    expect(isOnTarget('/tabs/clients-archive', clients)).toBe(false);
    expect(isOnTarget('/tabs/home', clients)).toBe(false);
  });

  // The list is not the booking: an alert about one session still has
  // something to announce while you are looking at all of them.
  it('is false above the target', () => {
    const booking = { screen: 'sessions', entityId: 'abc' };
    expect(isOnTarget('/tabs/user/sessions', booking)).toBe(false);
    expect(isOnTarget('/tabs/user/sessions/abc', booking)).toBe(true);
  });

  it('is false when the notification has nowhere to go', () => {
    expect(isOnTarget('/tabs/home', { screen: 'groups' })).toBe(false);
    expect(isOnTarget('/tabs/home', null)).toBe(false);
  });
});
