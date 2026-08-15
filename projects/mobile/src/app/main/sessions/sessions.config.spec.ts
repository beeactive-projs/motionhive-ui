/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import {
  LOCATION_KIND_OPTIONS,
  SESSION_ICONS,
  SESSION_TYPE_OPTIONS,
} from './sessions.config';

/** Every template in this feature, inlined at build time by Vite. */
const templates = import.meta.glob('./**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** `person-outline` → `personOutline`, the key `addIcons()` registers under. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Icon names this feature can render.
 *
 * Three sources, because a name reaches `ion-icon` three ways here: a static
 * attribute, a kebab literal inside a conditional binding, and the `icon` field
 * on the option constants the create sheet iterates — that last one lives in
 * TypeScript, so no amount of template scanning would find it.
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

  for (const option of [...SESSION_TYPE_OPTIONS, ...LOCATION_KIND_OPTIONS]) {
    names.add(option.icon);
  }

  // Ionic's own components name these; we never register them.
  names.delete('crescent');
  return [...names];
}

const registered = new Set(Object.keys(SESSION_ICONS));

describe('SESSION_ICONS', () => {
  // An unregistered name renders as a blank box with no error anywhere, which
  // is exactly the kind of thing that ships. Same guard as ACCOUNT_ICONS.
  it('registers every icon the sessions screens render', () => {
    const used = iconNamesUsed();
    expect(used.length).toBeGreaterThan(0);

    for (const name of used) {
      expect(registered, `${name} is used but not registered`).toContain(toCamelCase(name));
    }
  });

  // The opposite drift: icons kept around for screens that changed.
  it('registers nothing the screens do not use', () => {
    const used = new Set(iconNamesUsed().map(toCamelCase));

    for (const key of registered) {
      expect(used, `${key} is registered but unused`).toContain(key);
    }
  });
});

describe('option constants', () => {
  // The BE expects ISO 8601 weekdays. Getting this wrong shifts an entire
  // recurring series by a day, which is invisible until someone turns up on
  // the wrong morning.
  it('keeps weekday values ISO 1=Mon..7=Sun', async () => {
    const { WEEKDAYS } = await import('./sessions.config');
    expect(WEEKDAYS.map((d) => d.value)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(WEEKDAYS[0].label).toBe('M');
    expect(WEEKDAYS[6].label).toBe('S');
  });

  it('offers only cancel scopes the API accepts', async () => {
    const { CANCEL_SCOPE_OPTIONS } = await import('./sessions.config');
    expect(CANCEL_SCOPE_OPTIONS.map((o) => o.value)).toEqual([
      'this',
      'thisAndFuture',
      'series',
    ]);
  });
});
