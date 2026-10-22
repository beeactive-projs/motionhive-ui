/// <reference types="vite/client" />
import {
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationSkippedCode,
  NavigationStart,
  RoutesRecognized,
} from '@angular/router';
import { describe, expect, it } from 'vitest';

import { isNavigationSettled } from './tabs';

/**
 * The tab bar hides itself on the chat routes and shows itself again when the
 * router next settles. Deriving that only from `NavigationEnd` left the bar
 * hidden for the rest of the session whenever a navigation ended any other
 * way — on every tab, until the app was restarted.
 *
 * These assert the three events that are not `NavigationEnd`, because a test
 * that only covered the happy path would pass against the bug.
 */
describe('isNavigationSettled', () => {
  it('counts a navigation that arrived', () => {
    expect(isNavigationSettled(new NavigationEnd(1, '/tabs/messages', '/tabs/messages'))).toBe(
      true,
    );
  });

  it('counts a navigation a guard turned back', () => {
    const cancelled = new NavigationCancel(
      1,
      '/tabs/messages/42',
      '',
      NavigationCancellationCode.GuardRejected,
    );
    expect(isNavigationSettled(cancelled)).toBe(true);
  });

  it('counts a navigation that failed, which is how a dropped chunk ends', () => {
    expect(isNavigationSettled(new NavigationError(1, '/tabs/messages/42', new Error()))).toBe(
      true,
    );
  });

  it('counts a navigation skipped as a no-op', () => {
    const skipped = new NavigationSkipped(
      1,
      '/tabs/messages',
      '',
      NavigationSkippedCode.IgnoredSameUrlNavigation,
    );
    expect(isNavigationSettled(skipped)).toBe(true);
  });

  it('ignores the events mid-flight, where the router has not landed yet', () => {
    expect(isNavigationSettled(new NavigationStart(1, '/tabs/messages'))).toBe(false);
    expect(
      isNavigationSettled(new RoutesRecognized(1, '/tabs/messages', '/tabs/messages', null!)),
    ).toBe(false);
  });
});
