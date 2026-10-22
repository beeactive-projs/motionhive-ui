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

import { hidesTabBar, isNavigationSettled } from './tabs';

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

/**
 * A fake route node: only the two fields the traversal reads.
 */
function node(data: Record<string, unknown>, child?: unknown): unknown {
  return { data, firstChild: child ?? null };
}

/**
 * The bar is hidden on the chat routes and shown again on every other page.
 * Reading the live `routerState.root` instead of its snapshot left it hidden
 * for the rest of the session, because Ionic keeps a left page alive in its
 * stack and the traversal kept arriving at the chat.
 */
describe('hidesTabBar', () => {
  it('hides on the page that asks for it', () => {
    const tree = node({}, node({}, node({ hideTabBar: true })));
    expect(hidesTabBar(tree as never)).toBe(true);
  });

  it('shows on a page that does not, even under a parent that did', () => {
    const tree = node({ hideTabBar: true }, node({}, node({})));
    expect(hidesTabBar(tree as never)).toBe(false);
  });

  it('shows when nothing in the tree asks', () => {
    expect(hidesTabBar(node({}, node({})) as never)).toBe(false);
  });

  it('reads the leaf, not an ancestor: only the page on screen decides', () => {
    const tree = node({}, node({ hideTabBar: true }, node({ hideTabBar: false })));
    expect(hidesTabBar(tree as never)).toBe(false);
  });
});
