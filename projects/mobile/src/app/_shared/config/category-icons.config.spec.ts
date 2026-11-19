import { describe, expect, it } from 'vitest';

import { ACTIVITY_FALLBACK_ICON, categoryIcon } from './category-icons.config';

/** Every icon migration 081 seeds, so a category never draws as a blank box. */
const SEEDED_ICONS = [
  'barbell-outline',
  'footsteps-outline',
  'flower-outline',
  'body-outline',
  'flash-outline',
  'bicycle-outline',
  'water-outline',
  'hand-left-outline',
  'musical-notes-outline',
  'accessibility-outline',
  'trail-sign-outline',
  'football-outline',
  'heart-outline',
  'nutrition-outline',
  'trending-up-outline',
  'flame-outline',
  'pulse-outline',
  'leaf-outline',
  'trophy-outline',
  'happy-outline',
];

describe('categoryIcon', () => {
  it('registers every icon the category list seeds', () => {
    for (const icon of SEEDED_ICONS) {
      expect(categoryIcon(icon)).toBe(icon);
    }
  });

  it('falls back for a name nobody registered', () => {
    expect(categoryIcon('rocket-outline')).toBe(ACTIVITY_FALLBACK_ICON);
    expect(categoryIcon(null)).toBe(ACTIVITY_FALLBACK_ICON);
    expect(categoryIcon(ACTIVITY_FALLBACK_ICON)).toBe(ACTIVITY_FALLBACK_ICON);
  });
});
