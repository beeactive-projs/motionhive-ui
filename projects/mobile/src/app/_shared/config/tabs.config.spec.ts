import { describe, expect, it } from 'vitest';
import { NavModes } from 'core';

import {
  activeTabIdFromUrl,
  COACH_TAB_SET,
  resolveMode,
  TAB_ICONS,
  TAB_SETS,
  TRAIN_TAB_SET,
} from './tabs.config';
import { TabIds } from '../models/tab.model';

describe('resolveMode', () => {
  it('honours the stored mode for a coach', () => {
    expect(resolveMode(true, NavModes.Coach)).toBe(NavModes.Coach);
    expect(resolveMode(true, NavModes.Train)).toBe(NavModes.Train);
  });

  it('pins a non-coach to train even when coach is stored', () => {
    // Someone who loses the instructor role must not be left with a coach tab
    // bar full of routes their guards will bounce them out of.
    expect(resolveMode(false, NavModes.Coach)).toBe(NavModes.Train);
  });
});

describe('activeTabIdFromUrl', () => {
  it('reads the first segment after /tabs', () => {
    expect(activeTabIdFromUrl('/tabs/clients')).toBe(TabIds.Clients);
  });

  it('keeps a nested page on its parent tab', () => {
    // The whole reason the account area and Requests are nested rather than
    // siblings. The three-segment case is what keeps the Home tab lit across
    // every screen under /tabs/home/account.
    expect(activeTabIdFromUrl('/tabs/clients/requests')).toBe(TabIds.Clients);
    expect(activeTabIdFromUrl('/tabs/home/account')).toBe(TabIds.Home);
    expect(activeTabIdFromUrl('/tabs/home/account/profile')).toBe(TabIds.Home);
  });

  it('ignores query strings and fragments', () => {
    expect(activeTabIdFromUrl('/tabs/clients/requests?requestId=abc')).toBe(TabIds.Clients);
    expect(activeTabIdFromUrl('/tabs/home#top')).toBe(TabIds.Home);
  });

  it('returns nothing outside the tab shell', () => {
    expect(activeTabIdFromUrl('/auth/login')).toBeUndefined();
    expect(activeTabIdFromUrl('/tabs')).toBeUndefined();
    expect(activeTabIdFromUrl('/')).toBeUndefined();
  });
});

describe('tab set configuration', () => {
  it('lands both modes on a tab that mode actually has', () => {
    for (const set of Object.values(TAB_SETS)) {
      expect(set.tabs.some((tab) => tab.id === set.defaultTab)).toBe(true);
    }
  });

  it('shares home and messages so their stacks survive a mode swap', () => {
    // These two are tracked by id across the swap, so their buttons are never
    // recreated and never lose their selected state.
    for (const shared of [TabIds.Home, TabIds.Messages]) {
      expect(COACH_TAB_SET.tabs.some((tab) => tab.id === shared)).toBe(true);
      expect(TRAIN_TAB_SET.tabs.some((tab) => tab.id === shared)).toBe(true);
    }
  });

  it('gives each mode its own role-segmented sessions tab', () => {
    // The two sessions surfaces live under /tabs/coach/sessions and
    // /tabs/user/sessions — separate stacks, separate deep-link addresses —
    // so each set carries its role segment as the tab id, never the other's.
    expect(COACH_TAB_SET.tabs.some((tab) => tab.id === TabIds.Coach)).toBe(true);
    expect(COACH_TAB_SET.tabs.some((tab) => tab.id === TabIds.User)).toBe(false);
    expect(TRAIN_TAB_SET.tabs.some((tab) => tab.id === TabIds.User)).toBe(true);
    expect(TRAIN_TAB_SET.tabs.some((tab) => tab.id === TabIds.Coach)).toBe(false);
  });

  it('keeps workouts reachable from More after losing its tab slot', () => {
    expect(TRAIN_TAB_SET.more.some((tile) => tile.route === '/tabs/workouts')).toBe(
      true,
    );
  });

  it('registers every icon name it renders', () => {
    // addIcons() is fed TAB_ICONS; an unregistered name renders as a blank box.
    const registered = new Set(
      Object.keys(TAB_ICONS).map((key) => key.replace(/([A-Z])/g, '-$1').toLowerCase()),
    );
    const used = Object.values(TAB_SETS).flatMap((set) => [
      ...set.tabs.map((tab) => tab.icon),
      ...set.more.map((tile) => tile.icon),
    ]);

    for (const icon of used) {
      expect(registered, `icon "${icon}" is used but not in TAB_ICONS`).toContain(icon);
    }
  });

  it('marks every coach-only More tile as requiring the instructor role', () => {
    const coachOnly = COACH_TAB_SET.more.filter((tile) => tile.route.startsWith('/tabs/clients'));
    expect(coachOnly.length).toBeGreaterThan(0);
    for (const tile of coachOnly) {
      expect(tile.requiresInstructor).toBe(true);
    }
  });
});
