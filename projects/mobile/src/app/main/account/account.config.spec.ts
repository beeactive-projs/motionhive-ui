import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_ICONS,
  NOTIFICATION_CATEGORY_STYLES,
  NOTIFICATION_STYLE_FALLBACK,
  SOCIAL_ICONS,
} from './account.config';

/** `person-outline` → `personOutline`, the key `addIcons()` registers under. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

const registered = new Set(Object.keys(ACCOUNT_ICONS));

describe('ACCOUNT_ICONS', () => {
  // An unregistered icon name renders as a blank box with no error anywhere,
  // which is exactly the kind of thing that ships. Same guard as TAB_ICONS.
  it('registers every icon the notification rows can render', () => {
    const names = [
      ...Object.values(NOTIFICATION_CATEGORY_STYLES).map((style) => style.icon),
      NOTIFICATION_STYLE_FALLBACK.icon,
    ];

    for (const name of names) {
      expect(registered, `${name} is not registered`).toContain(toCamelCase(name));
    }
  });

  it('registers every social platform icon', () => {
    for (const name of Object.values(SOCIAL_ICONS)) {
      expect(registered, `${name} is not registered`).toContain(toCamelCase(name));
    }
  });

  it('maps every notification category to a real palette colour', () => {
    const palette = ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'violet', 'medium', 'dark'];

    for (const style of Object.values(NOTIFICATION_CATEGORY_STYLES)) {
      expect(palette).toContain(style.color);
    }
    expect(palette).toContain(NOTIFICATION_STYLE_FALLBACK.color);
  });
});
