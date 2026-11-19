import { describe, expect, it } from 'vitest';

import { swipeBackDefault } from './swipe-back';

/** Ionic's config, holding only what is set; `getBoolean` falls back as Ionic's does. */
function config(values: Record<string, unknown>) {
  return {
    get: (key: string, fallback?: unknown) => (key in values ? values[key] : fallback),
    getBoolean: (key: string, fallback = false) =>
      key in values ? Boolean(values[key]) : fallback,
  };
}

describe('swipeBackDefault', () => {
  it('is on in iOS mode and off in md, as Ionic sets it up', () => {
    expect(swipeBackDefault(config({ mode: 'ios' }))).toBe(true);
    expect(swipeBackDefault(config({ mode: 'md' }))).toBe(false);
  });

  it('follows swipeBackEnabled when the app sets it', () => {
    expect(swipeBackDefault(config({ mode: 'ios', swipeBackEnabled: false }))).toBe(false);
    expect(swipeBackDefault(config({ mode: 'md', swipeBackEnabled: true }))).toBe(true);
  });
});
