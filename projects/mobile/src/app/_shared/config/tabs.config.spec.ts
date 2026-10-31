import { describe, expect, it } from 'vitest';
import { NavModes } from 'core';

import {
  activeTabIdFromUrl,
  COACH_TAB_SET,
  litTabId,
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
    // The whole reason the account area and a client page are nested rather than
    // siblings. The three-segment case is what keeps the Menu tab lit across
    // every screen under /tabs/more/account.
    expect(activeTabIdFromUrl('/tabs/clients/user-1')).toBe(TabIds.Clients);
    expect(activeTabIdFromUrl('/tabs/more/account')).toBe(TabIds.More);
    expect(activeTabIdFromUrl('/tabs/more/account/profile')).toBe(TabIds.More);
  });

  it('ignores query strings and fragments', () => {
    expect(activeTabIdFromUrl('/tabs/clients?filter=requests')).toBe(TabIds.Clients);
    expect(activeTabIdFromUrl('/tabs/home#top')).toBe(TabIds.Home);
  });

  it('returns nothing outside the tab shell', () => {
    expect(activeTabIdFromUrl('/auth/login')).toBeUndefined();
    expect(activeTabIdFromUrl('/tabs')).toBeUndefined();
    expect(activeTabIdFromUrl('/')).toBeUndefined();
  });
});

describe('litTabId', () => {
  const coachTabs = COACH_TAB_SET.tabs.map((tab) => tab.id);
  const trainTabs = TRAIN_TAB_SET.tabs.map((tab) => tab.id);

  it("lights a real tab's own button", () => {
    for (const tab of coachTabs) expect(litTabId(tab, coachTabs)).toBe(tab);
    for (const tab of trainTabs) expect(litTabId(tab, trainTabs)).toBe(tab);
    expect(litTabId(TabIds.More, coachTabs)).toBe(TabIds.More);
  });

  it('lights the Menu for every stack the Menu opens, in both modes', () => {
    // The audit: coach Sessions / Programs / Exercises / Groups lit nothing,
    // and a trainee's Sessions lit nothing.
    const fromMenu = (set: typeof COACH_TAB_SET) =>
      set.more
        .flatMap((section) => section.items)
        .map((tile) => activeTabIdFromUrl(tile.route));
    for (const stack of fromMenu(COACH_TAB_SET)) {
      expect(litTabId(stack, coachTabs)).toBe(TabIds.More);
    }
    for (const stack of fromMenu(TRAIN_TAB_SET)) {
      expect(litTabId(stack, trainTabs)).toBe(TabIds.More);
    }
  });

  it("lights the Menu for a stack that is a tab only in the other mode", () => {
    expect(litTabId(TabIds.Workouts, coachTabs)).toBe(TabIds.More);
    expect(litTabId(TabIds.Clients, trainTabs)).toBe(TabIds.More);
  });

  it('lights nothing outside the shell', () => {
    expect(litTabId(undefined, coachTabs)).toBeUndefined();
  });
});

describe('tab set configuration', () => {
  it('lands both modes on a tab that mode actually has', () => {
    for (const set of Object.values(TAB_SETS)) {
      expect(set.tabs.some((tab) => tab.id === set.defaultTab)).toBe(true);
    }
  });

  it('shares home, discover and messages so their stacks survive a mode swap', () => {
    // These are tracked by id across the swap, so their buttons are never
    // recreated and never lose their selected state.
    for (const shared of [TabIds.Home, TabIds.Discover, TabIds.Messages]) {
      expect(COACH_TAB_SET.tabs.some((tab) => tab.id === shared)).toBe(true);
      expect(TRAIN_TAB_SET.tabs.some((tab) => tab.id === shared)).toBe(true);
    }
  });

  it("keeps each mode's own sessions in its menu after Discover took the tab", () => {
    // The two sessions surfaces still live under /tabs/coach/sessions and
    // /tabs/user/sessions, separate stacks and deep-link addresses; whatever
    // gives up a tab slot has to stay reachable, and only the mode's own.
    const routes = (set: typeof COACH_TAB_SET) =>
      set.more.flatMap((section) => section.items).map((tile) => tile.route);
    expect(routes(COACH_TAB_SET)).toContain('/tabs/coach/sessions');
    expect(routes(COACH_TAB_SET)).not.toContain('/tabs/user/sessions');
    expect(routes(TRAIN_TAB_SET)).toContain('/tabs/user/sessions');
    expect(routes(TRAIN_TAB_SET)).not.toContain('/tabs/coach/sessions');
    for (const set of Object.values(TAB_SETS)) {
      expect(set.tabs.some((tab) => tab.id === TabIds.Coach || tab.id === TabIds.User)).toBe(false);
    }
  });

  it('gives the trainee a workouts tab, training being the daily surface', () => {
    expect(TRAIN_TAB_SET.tabs.some((tab) => tab.id === TabIds.Workouts)).toBe(true);
  });

  it('puts discover in the tab bar of both modes, and not again in the menu', () => {
    for (const set of Object.values(TAB_SETS)) {
      expect(set.tabs.some((tab) => tab.id === TabIds.Discover)).toBe(true);
      const tiles = set.more.flatMap((section) => section.items);
      expect(tiles.some((tile) => tile.route === '/tabs/discover')).toBe(false);
    }
  });

  it('offers groups in both modes, mirroring the web shared nav block', () => {
    for (const set of Object.values(TAB_SETS)) {
      const tiles = set.more.flatMap((section) => section.items);
      expect(tiles.some((tile) => tile.route === '/tabs/groups')).toBe(true);
    }
  });

  it('labels every menu section', () => {
    // An unlabeled card under a labeled one reads as part of that section.
    for (const set of Object.values(TAB_SETS)) {
      for (const section of set.more) {
        expect(section.label).not.toBe('');
      }
    }
  });

  it('registers every icon name it renders', () => {
    // addIcons() is fed TAB_ICONS; an unregistered name renders as a blank box.
    const registered = new Set(
      Object.keys(TAB_ICONS).map((key) => key.replace(/([A-Z])/g, '-$1').toLowerCase()),
    );
    const used = Object.values(TAB_SETS).flatMap((set) => [
      ...set.tabs.map((tab) => tab.icon),
      ...set.more.flatMap((section) => section.items.map((tile) => tile.icon)),
    ]);

    for (const icon of used) {
      expect(registered, `icon "${icon}" is used but not in TAB_ICONS`).toContain(icon);
    }
  });

  // Requests are the Clients tab's chip, answered from a sheet there; a menu
  // row pointing into that tab would be a second way in to the same list.
  it('gives requests no menu row of their own', () => {
    const tiles = COACH_TAB_SET.more.flatMap((section) => section.items);
    expect(tiles.some((tile) => tile.route.startsWith('/tabs/clients'))).toBe(false);
  });
});
