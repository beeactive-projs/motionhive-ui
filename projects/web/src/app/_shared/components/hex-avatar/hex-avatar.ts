import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  HEX_AVATAR_PALETTE,
  HEX_CLIP_PATH,
  HexAvatarTone,
  toneForUserId,
} from './hex-avatar-tone';

/**
 * MotionHive's hexagonal avatar primitive.
 *
 * Separate from the circle `<mh-avatar>` (which uses PrimeNG) so we
 * don't disturb every other place avatars are rendered. Use this in
 * messaging surfaces (the conversation list, chat header, bubbles,
 * detail rail) and anywhere else the brand wants the hex look.
 *
 * Tone is either explicit (`tone="honey"`) or derived from a userId
 * — the messaging row passes the participant's id so the same person
 * always gets the same color across the inbox.
 *
 * If `imageUrl` is provided it covers the hex; otherwise we render
 * `initials` (or `?` as a fallback). The 1.155 aspect ratio matches
 * the design's geometry — width:height = 1:cos(30°).
 */
@Component({
  selector: 'mh-hex-avatar',
  standalone: true,
  template: `
    <div class="mh-hex" [style.width.px]="size()" [style.height.px]="height()" [style.background]="background()" [style.color]="palette().fg" [style.font-size.px]="fontSize()">
      @if (!imageUrl()) {
        <span class="mh-hex__label">{{ initials() || '?' }}</span>
      }
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }
    .mh-hex {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      clip-path: ${HEX_CLIP_PATH};
      font-family: 'Poppins', 'Inter', sans-serif;
      font-weight: 600;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
    }
    .mh-hex__label {
      line-height: 1;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HexAvatar {
  readonly size = input<number>(40);
  /** Caller-supplied tone wins. When absent, we derive from `userId`. */
  readonly tone = input<HexAvatarTone | undefined>(undefined);
  /** Used by the deterministic tone hash when `tone` is not set. */
  readonly userId = input<string | null | undefined>(null);
  readonly initials = input<string>('');
  readonly imageUrl = input<string | null | undefined>(null);

  protected readonly height = computed(() => Math.round(this.size() * 1.155));
  protected readonly fontSize = computed(() => Math.round(this.size() * 0.36));

  protected readonly palette = computed(() => {
    const tone = this.tone() ?? toneForUserId(this.userId());
    return HEX_AVATAR_PALETTE[tone];
  });

  protected readonly background = computed(() => {
    const { bg } = this.palette();
    const url = this.imageUrl();
    return url ? `center / cover no-repeat url("${url}"), ${bg}` : bg;
  });
}
