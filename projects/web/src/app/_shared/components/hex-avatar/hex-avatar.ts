import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AvatarUser, Hex } from 'core';
import { HEX_AVATAR_PALETTE, HexAvatarTone, toneForUserId } from './hex-avatar-tone';

/** Regular point-top hex: width:height = cos(30°):1. */
const POINTY_RATIO = 1 / Math.cos(Math.PI / 6); // ≈ 1.1547

/**
 * MotionHive's hexagonal avatar primitive.
 *
 * Thin wrapper over the shared core `<mh-hex>` — it keeps the
 * avatar-specific concerns (deterministic per-user tone, image-or-initials)
 * and delegates the actual hexagon (rounded geometry, clipping) to the one
 * shared component so messaging avatars match every other hex in the app.
 *
 * Tone is either explicit (`tone="honey"`) or derived from `userId` — the
 * messaging row passes the participant's id so the same person always gets
 * the same color across the inbox. If `imageUrl` is provided it covers the
 * hex; otherwise we render `initials` (or `?`).
 *
 * `size` is the avatar **width** (point-top hexes are taller than wide), kept
 * for API compatibility with every existing call site.
 */
@Component({
  selector: 'mh-hex-avatar',
  standalone: true,
  imports: [Hex],
  template: `
    <mh-hex
      orientation="pointy"
      [size]="coreSize()"
      [round]="round()"
      [bg]="palette().bg"
      [fg]="palette().fg"
      [img]="resolvedImage()"
      [label]="resolvedImage() ? null : resolvedInitials() || '?'"
      [fontSize]="fontSize()"
    />
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex-shrink: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HexAvatar {
  /** Avatar width in px (height is derived from the regular-hex ratio). */
  readonly size = input<number>(40);
  /** Caller-supplied tone wins. When absent, we derive from `userId` / name. */
  readonly tone = input<HexAvatarTone | undefined>(undefined);
  /** Used by the deterministic tone hash when `tone` is not set. */
  readonly userId = input<string | null | undefined>(null);
  readonly initials = input<string>('');
  readonly imageUrl = input<string | null | undefined>(null);
  /**
   * Convenience input — pass a user object and we derive initials + image,
   * and seed the deterministic tone from their name (`AvatarUser` has no id).
   * Explicit `userId` / `initials` / `imageUrl` still win when supplied.
   */
  readonly user = input<AvatarUser | null | undefined>(null);

  /** Core `<mh-hex>` sizes on its long axis (height for point-top). */
  protected readonly coreSize = computed(() => Math.round(this.size() * POINTY_RATIO));
  /** Less corner rounding on tiny avatars so the silhouette stays crisp. */
  protected readonly round = computed(() => (this.coreSize() <= 30 ? 5 : 7));
  protected readonly fontSize = computed(() => Math.round(this.size() * 0.36));

  protected readonly resolvedImage = computed(
    () => this.imageUrl() ?? this.user()?.avatarUrl ?? null,
  );

  protected readonly resolvedInitials = computed(() => {
    if (this.initials()) return this.initials();
    const u = this.user();
    if (!u) return '';
    return ((u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '')).toUpperCase();
  });

  /** Tone seed: explicit id, else the user's name (stable per person). */
  private readonly seed = computed(() => {
    const id = this.userId();
    if (id) return id;
    const u = this.user();
    const name = u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '';
    return name || null;
  });

  protected readonly palette = computed(() => {
    const tone = this.tone() ?? toneForUserId(this.seed());
    return HEX_AVATAR_PALETTE[tone];
  });
}
