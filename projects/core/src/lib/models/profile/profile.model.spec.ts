import { describe, expect, it } from 'vitest';

import { ProfilePrivacy } from './profile.enums';
import { PROFILE_PRIVACY_DEFAULTS, resolveFieldPrivacy } from './profile.model';

describe('birthday and gender privacy', () => {
  it('shows both to coaches by default and nothing in public', () => {
    expect(PROFILE_PRIVACY_DEFAULTS.birthDate).toBe(ProfilePrivacy.CoachesOnly);
    expect(PROFILE_PRIVACY_DEFAULTS.gender).toBe(ProfilePrivacy.CoachesOnly);
    expect(resolveFieldPrivacy({}, 'birthDate')).toBe(ProfilePrivacy.CoachesOnly);
    expect(resolveFieldPrivacy(null, 'gender')).toBe(ProfilePrivacy.CoachesOnly);
  });

  it("reads the person's own choice over the default", () => {
    const settings = { birthDate: ProfilePrivacy.OnlyMe, gender: ProfilePrivacy.Public };
    expect(resolveFieldPrivacy(settings, 'birthDate')).toBe(ProfilePrivacy.OnlyMe);
    expect(resolveFieldPrivacy(settings, 'gender')).toBe(ProfilePrivacy.Public);
  });
});
