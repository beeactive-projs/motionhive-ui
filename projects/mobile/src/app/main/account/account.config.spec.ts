import { describe, expect, it } from 'vitest';

import { ACCOUNT_ICONS, SOCIAL_ICONS } from './account.config';

/** `person-outline` → `personOutline`, the key `addIcons()` registers under. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

const registered = new Set(Object.keys(ACCOUNT_ICONS));

describe('ACCOUNT_ICONS', () => {
  // An unregistered icon name renders as a blank box with no error anywhere,
  // which is exactly the kind of thing that ships. Same guard as TAB_ICONS.
  it('registers every social platform icon', () => {
    for (const name of Object.values(SOCIAL_ICONS)) {
      expect(registered, `${name} is not registered`).toContain(toCamelCase(name));
    }
  });
});
