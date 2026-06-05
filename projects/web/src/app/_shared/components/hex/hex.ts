import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type HexTone =
  | 'honey'
  | 'honey-soft'
  | 'coral'
  | 'coral-soft'
  | 'teal'
  | 'teal-soft'
  | 'navy'
  | 'navy-soft';

export type HexSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * MotionHive's signature shape — point-up-and-down hexagon (flat sides
 * left/right). Used everywhere on the home page: avatars, stat blocks,
 * list glyphs, the brand mark itself.
 *
 * Sizes/tones come straight from the home-page design spec; if you need
 * a new size or tone, add it here so call-sites stay consistent.
 */
@Component({
  selector: 'mh-hex',
  templateUrl: './hex.html',
  styleUrl: './hex.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hex {
  readonly tone = input<HexTone>('honey');
  readonly size = input<HexSize>('md');

  readonly hostClass = computed(() => `hex hex-${this.size()} hex-${this.tone()}`);
}
