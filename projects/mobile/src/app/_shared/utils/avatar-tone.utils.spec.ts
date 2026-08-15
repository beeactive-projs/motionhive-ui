import { describe, expect, it } from 'vitest';

import { avatarToneFor } from './avatar-tone.utils';

const TONES = ['primary', 'teal', 'secondary', 'coral'];

describe('avatarToneFor', () => {
  it('always returns a tone the theme defines', () => {
    for (let i = 0; i < 200; i++) {
      expect(TONES).toContain(avatarToneFor(`user-${i}`));
    }
  });

  it('gives the same person the same tone every time', () => {
    const id = '9962dd07-bae2-4e2f-8717-c99e18549bd5';
    expect(avatarToneFor(id)).toBe(avatarToneFor(id));
  });

  it('falls back rather than indexing off the array', () => {
    expect(TONES).toContain(avatarToneFor(null));
    expect(TONES).toContain(avatarToneFor(undefined));
    expect(TONES).toContain(avatarToneFor(''));
  });

  it('spreads ids across every tone', () => {
    const seen = new Set(
      Array.from({ length: 400 }, (_, i) => avatarToneFor(`0000000${i}-aaaa-bbbb-cccc-${i}`)),
    );
    expect(seen.size).toBe(TONES.length);
  });
});
