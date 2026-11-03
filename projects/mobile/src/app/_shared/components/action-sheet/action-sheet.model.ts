import { HexAvatarTone } from '../hex-avatar/hex-avatar';

/**
 * The hues a verb's tile may take, from the tile table in `lists.md`. Grey is
 * not one: the sheet greys a verb itself while it is off (`disabled`), so an
 * available verb is never grey (docs/MOBILE-ACTIONS.md).
 */
export type SheetActionColor =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'violet'
  | 'teal'
  | 'coral';

/**
 * One verb on an action sheet. `label` and `hint` are translation keys — the
 * sheet translates them, so the lists can live in plain config.
 */
export interface SheetAction<T extends string = string> {
  id: T;
  label: string;
  /** A second line under the label, for verbs whose effect needs saying. */
  hint?: string;
  icon?: string;
  /** Ionic palette name for the tile, the concept's hue; a destructive verb's is `danger`. */
  color: SheetActionColor;
  /** `shade` for a hue whose 500 fails 3:1 under the white glyph (info, success). */
  tone?: HexAvatarTone;
  /** Sorted into its own card after the others, in red. The only verbs that are red. */
  destructive?: boolean;
  /** Off for now: the sheet greys its tile and the row takes no taps. */
  disabled?: boolean;
}
