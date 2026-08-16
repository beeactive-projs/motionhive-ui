import { describe, expect, it } from 'vitest';

import { NotificationCategory } from 'core';

import {
  CATEGORY_ICONS,
  CATEGORY_ORDER,
  CATEGORY_STYLES,
  FILTERABLE_CATEGORIES,
  categoryStyle,
} from './notification-categories.config';

/** `person-outline` → `personOutline`, the key `addIcons()` registers under. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

const registered = new Set(Object.keys(CATEGORY_ICONS));

/**
 * `mh-hex-avatar` builds its fill from `--ion-color-<color>-wash`, so a colour
 * outside this list resolves to an undefined variable and paints nothing.
 */
const PALETTE = [
  'primary',
  'secondary',
  'success',
  'warning',
  'danger',
  'info',
  'violet',
  'teal',
  'coral',
  'medium',
  'dark',
];

describe('CATEGORY_STYLES', () => {
  it('covers every category the server can send', () => {
    for (const category of Object.values(NotificationCategory)) {
      expect(CATEGORY_STYLES[category], `${category} has no style`).toBeDefined();
    }
  });

  // Unregistered names render as a blank box with no error anywhere.
  it('registers every glyph it names', () => {
    for (const style of Object.values(CATEGORY_STYLES)) {
      expect(registered, `${style.icon} is not registered`).toContain(toCamelCase(style.icon));
    }
    // The fallback has to be registered too — it is what an unknown category
    // renders, which is the one case nobody looks at before shipping.
    expect(registered).toContain(
      toCamelCase(categoryStyle('unknown' as NotificationCategory).icon),
    );
  });

  it('maps every category to a palette colour that has a wash step', () => {
    for (const style of Object.values(CATEGORY_STYLES)) {
      expect(PALETTE, `${style.label} uses ${style.color}`).toContain(style.color);
    }
    expect(PALETTE).toContain(categoryStyle('unknown' as NotificationCategory).color);
  });

  // Red belongs to unread. A category wearing it would make every row of that
  // kind look urgent.
  it('leaves danger to the unread state', () => {
    for (const style of Object.values(CATEGORY_STYLES)) {
      expect(style.color).not.toBe('danger');
    }
  });

  it('lists every category in the preferences order, exactly once', () => {
    expect([...CATEGORY_ORDER].sort()).toEqual(Object.values(NotificationCategory).sort());
  });

  // A Messaging chip could only ever return "nothing here" — the type behind
  // it is suppressed in-app on purpose.
  it('offers every category as a filter chip except Messaging', () => {
    expect(FILTERABLE_CATEGORIES).not.toContain(NotificationCategory.Messaging);
    expect(FILTERABLE_CATEGORIES).toHaveLength(CATEGORY_ORDER.length - 1);
  });
});
