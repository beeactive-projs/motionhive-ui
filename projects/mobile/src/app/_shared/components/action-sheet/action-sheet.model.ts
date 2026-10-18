import { HexAvatarTone } from '../hex-avatar/hex-avatar';

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
  /** Ionic palette name for the glyph; omitted, it takes the row's ink. */
  color?: string;
  /** `shade` for a hue whose 500 fails 3:1 under the white glyph (info, success). */
  tone?: HexAvatarTone;
  /** Sorted into its own card after the others, in red. The only verbs that are red. */
  destructive?: boolean;
  disabled?: boolean;
}
