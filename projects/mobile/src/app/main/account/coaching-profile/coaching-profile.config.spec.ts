/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { VenueKind } from 'core';

import { COACHING_PROFILE_ICONS, priceLine, venueLine } from './coaching-profile.config';

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

  it('registers every venue tile', () => {
    for (const kind of Object.values(VenueKind)) {
      for (const isOnline of [true, false]) {
        const { icon } = venueLine({ kind, isOnline, city: 'Cluj' });
        expect(registered, `${icon} is not registered`).toContain(toCamelCase(icon));
      }
    }
  });
});

describe('venueLine', () => {
  it('says Online for an online venue, whatever its kind', () => {
    expect(venueLine({ kind: VenueKind.ONLINE, isOnline: true, city: null })).toEqual({
      icon: 'videocam-outline',
      key: 'account.coachingProfile.venues.online',
      city: null,
    });
    expect(venueLine({ kind: VenueKind.OTHER, isOnline: true, city: 'Cluj' }).key).toBe(
      'account.coachingProfile.venues.online',
    );
  });

  it("says the coach comes to you for a client's home, never Online", () => {
    expect(venueLine({ kind: VenueKind.CLIENT_HOME, isOnline: false, city: null })).toEqual({
      icon: 'home-outline',
      key: 'account.coachingProfile.venues.clientHome',
      city: null,
    });
  });

  it('gives a place its city, and nothing when it has none', () => {
    expect(venueLine({ kind: VenueKind.GYM, isOnline: false, city: ' Bucharest ' })).toEqual({
      icon: 'location-outline',
      key: null,
      city: 'Bucharest',
    });
    expect(venueLine({ kind: VenueKind.PARK, isOnline: false, city: null })).toEqual({
      icon: 'location-outline',
      key: null,
      city: null,
    });
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
