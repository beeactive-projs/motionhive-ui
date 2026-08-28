/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { NotificationCategory } from 'core';

import {
  NOTIFICATION_ICONS,
  NO_FILTERS,
  activeFilterCount,
  categoryListLabel,
  sameFilters,
} from './notifications.config';

/** Every template in this feature, inlined at build time by Vite. */
const templates = import.meta.glob('./**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Component sources too — the empty state picks its tile icon in TypeScript. */
const sources = import.meta.glob(['./**/*.ts', '!./**/*.spec.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** `person-outline` → `personOutline`, the key `addIcons()` registers under. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Icon names these screens render: static attributes, kebab literals inside
 * bindings (the `?? 'notifications-outline'` fallback, the rail's chevron
 * pair), and `'…-outline'` literals assembled in TypeScript. The category
 * glyphs arrive through `CATEGORY_ICONS` and are covered by that config's own
 * spec — here they only need to survive the round trip.
 */
function iconNamesUsed(): string[] {
  const names = new Set<string>();

  for (const html of Object.values(templates)) {
    for (const match of html.matchAll(/\b(?:name|icon)="([a-z][a-z0-9-]*)"/g)) {
      names.add(match[1]);
    }
    for (const binding of html.matchAll(/\[(?:name|icon)\]="([^"]*)"/g)) {
      for (const literal of binding[1].matchAll(/'([a-z][a-z0-9-]*)'/g)) {
        names.add(literal[1]);
      }
    }
  }

  for (const ts of Object.values(sources)) {
    for (const match of ts.matchAll(/'([a-z][a-z-]*-outline)'/g)) {
      names.add(match[1]);
    }
  }

  return [...names];
}

const registered = new Set(Object.keys(NOTIFICATION_ICONS));

describe('NOTIFICATION_ICONS', () => {
  // An unregistered name renders as a blank box with no error anywhere, which
  // is exactly the kind of thing that ships. Same guard as SESSION_ICONS.
  it('registers every icon the notification screens render', () => {
    const used = iconNamesUsed();
    expect(used.length).toBeGreaterThan(0);

    for (const name of used) {
      expect(registered, `${name} is used but not registered`).toContain(toCamelCase(name));
    }
  });
});

describe('notification filters', () => {
  const { Sessions, Groups, Payments } = NotificationCategory;

  it('counts Unread once and each category on its own', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(activeFilterCount({ unreadOnly: true, categories: [] })).toBe(1);
    expect(activeFilterCount({ unreadOnly: true, categories: [Sessions, Payments] })).toBe(3);
  });

  it('compares categories regardless of tap order', () => {
    const a = { unreadOnly: false, categories: [Sessions, Payments] };
    const b = { unreadOnly: false, categories: [Payments, Sessions] };
    expect(sameFilters(a, b)).toBe(true);
    expect(sameFilters(a, { ...b, unreadOnly: true })).toBe(false);
    expect(sameFilters(a, { ...b, categories: [Payments] })).toBe(false);
  });

  it('names the picked categories in display order', () => {
    expect(categoryListLabel([])).toBeNull();
    expect(categoryListLabel([Payments])).toBe('Payments');
    expect(categoryListLabel([Payments, Sessions])).toBe('Sessions and Payments');
    expect(categoryListLabel([Groups, Payments, Sessions])).toBe('Sessions, Groups and Payments');
  });
});
