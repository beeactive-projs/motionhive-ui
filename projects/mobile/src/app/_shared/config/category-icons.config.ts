import {
  accessibilityOutline,
  barbellOutline,
  bicycleOutline,
  bodyOutline,
  ellipseOutline,
  flameOutline,
  flashOutline,
  flowerOutline,
  footballOutline,
  footstepsOutline,
  handLeftOutline,
  happyOutline,
  heartOutline,
  leafOutline,
  musicalNotesOutline,
  nutritionOutline,
  pulseOutline,
  trailSignOutline,
  trendingUpOutline,
  trophyOutline,
  waterOutline,
} from 'ionicons/icons';

/**
 * The glyphs the category list names (`category.icon`, migration 081), for
 * `addIcons()`. The API sends a name, and a name nobody registered draws as
 * a blank box, so a category with an unknown one falls back to
 * `ACTIVITY_FALLBACK_ICON` (`categoryIcon`).
 */
export const ACTIVITY_ICONS = {
  accessibilityOutline,
  barbellOutline,
  bicycleOutline,
  bodyOutline,
  ellipseOutline,
  flameOutline,
  flashOutline,
  flowerOutline,
  footballOutline,
  footstepsOutline,
  handLeftOutline,
  happyOutline,
  heartOutline,
  leafOutline,
  musicalNotesOutline,
  nutritionOutline,
  pulseOutline,
  trailSignOutline,
  trendingUpOutline,
  trophyOutline,
  waterOutline,
};

export const ACTIVITY_FALLBACK_ICON = 'ellipse-outline';

/** `barbellOutline` → `barbell-outline`, the name Ionic draws by. */
function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

const REGISTERED = new Set(Object.keys(ACTIVITY_ICONS).map(kebab));

/** The glyph to draw for a category: its own when registered, else the fallback. */
export function categoryIcon(name: string | null | undefined): string {
  if (name && REGISTERED.has(name)) {
    return name;
  }
  return ACTIVITY_FALLBACK_ICON;
}
