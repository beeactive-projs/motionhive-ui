import { describe, expect, it } from 'vitest';
import { NavModes } from 'core';

import { ROLE_ICONS, ROLE_LIST, ROLES, UPCOMING_ROLES } from './roles.config';

describe('roles configuration', () => {
  it('describes every switchable mode', () => {
    // A mode without a role entry would render a pill with no label.
    for (const mode of Object.values(NavModes)) {
      expect(ROLES[mode]?.mode).toBe(mode);
    }
  });

  it('lists coach first, matching the switch-role page order', () => {
    expect(ROLE_LIST.map((role) => role.mode)).toEqual([NavModes.Coach, NavModes.Train]);
  });

  it('registers every icon name it renders', () => {
    // addIcons() is fed ROLE_ICONS; an unregistered name renders as a blank box.
    const registered = new Set(
      Object.keys(ROLE_ICONS).map((key) => key.replace(/([A-Z])/g, '-$1').toLowerCase()),
    );
    const used = [
      ...ROLE_LIST.map((role) => role.icon),
      ...UPCOMING_ROLES.map((role) => role.icon),
      'chevron-down',
    ];

    for (const icon of used) {
      expect(registered, `icon "${icon}" is used but not in ROLE_ICONS`).toContain(icon);
    }
  });
});
