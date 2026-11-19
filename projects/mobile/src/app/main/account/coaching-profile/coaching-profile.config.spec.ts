/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { COACHING_PROFILE_ICONS, priceLine } from './coaching-profile.config';

/** The screen's templates, inlined at build time by Vite. */
const templates = import.meta.glob('./*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** `location-outline` → `locationOutline`, the key `addIcons()` registers under. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

const registered = new Set(Object.keys(COACHING_PROFILE_ICONS));

describe('COACHING_PROFILE_ICONS', () => {
  // An unregistered name renders as a blank box with no error anywhere.
  it('registers every icon named in the templates', () => {
    const used = new Set<string>();
    for (const html of Object.values(templates)) {
      for (const match of html.matchAll(/\b(?:name|icon)="([a-z][a-z0-9-]*)"/g)) {
        used.add(match[1]);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) {
      expect(registered, `${name} is used but not registered`).toContain(toCamelCase(name));
    }
  });
});

describe('priceLine', () => {
  it('puts a dot before a one-off label', () => {
    expect(priceLine('RON 75.00', 'One-off')).toBe('RON 75.00 · One-off');
  });

  it('lets a per-interval label bring its own slash', () => {
    expect(priceLine('RON 200.00', '/ month')).toBe('RON 200.00 / month');
    expect(priceLine('200,00 RON', '/ 3 luni')).toBe('200,00 RON / 3 luni');
  });

  it('shows the price alone without a label', () => {
    expect(priceLine('RON 75.00', '  ')).toBe('RON 75.00');
  });
});
