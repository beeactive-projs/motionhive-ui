import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MediaDemo } from '../../_shared/ui/media-demo/media-demo';
import type { MarketingFeature } from '../../_data/features';

/**
 * The eight features as a swipeable tab row with one panel below.
 *
 * On a phone the nine stacked cards this replaces were a long scroll past
 * nine repetitions of the same "see how it works" link, which people skipped.
 * One row of tabs puts every feature on screen at once and asks for a tap
 * instead, so the panel is the only thing that has to be tall.
 *
 * The clip is an `mh-media-demo`, the same component the feature pages use,
 * so it inherits the lazy load, the play-only-while-visible rule and the
 * full-screen lightbox rather than carrying a second copy of all three.
 */
@Component({
  selector: 'mh-feature-showcase',
  imports: [RouterLink, MediaDemo],
  templateUrl: './feature-showcase.html',
  styleUrl: './feature-showcase.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureShowcase {
  readonly features = input.required<readonly MarketingFeature[]>();

  /** Index of the open feature. Starts on the first, never empty. */
  readonly active = signal(0);

  readonly current = computed(() => this.features()[this.active()] ?? this.features()[0]);

  /** "1 / 8" over the clip, so the row reads as a set rather than a scroll. */
  readonly position = computed(() => `${this.active() + 1} / ${this.features().length}`);

  /** Drops the edge fade once there is nothing further to scroll to. */
  readonly atEnd = signal(false);

  onTabScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.atEnd.set(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }

  select(index: number): void {
    this.active.set(index);
  }

  /** The poster under each clip, and what shows where no clip exists yet. */
  shotFor(slug: string): string {
    return `/images/home-features/${slug}.png`;
  }
}
