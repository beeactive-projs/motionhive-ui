import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { MarketingFeature } from '../../_data/features';

/**
 * The eight features as a swipeable tab row with one panel below.
 *
 * On a phone the nine stacked cards this replaces were a long scroll past
 * nine repetitions of the same "see how it works" link, which people skipped.
 * One row of tabs puts every feature on screen at once and asks for a tap
 * instead, so the panel is the only thing that has to be tall.
 *
 * The clip area holds a crop of that one feature on a phone, never a shrunk
 * desktop window: a screenshot you have to pinch to read sells nothing.
 */
@Component({
  selector: 'mh-feature-showcase',
  imports: [RouterLink],
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

  select(index: number): void {
    this.active.set(index);
  }

  /** Each feature's crop lives next to the others, named by slug. */
  shotFor(slug: string): string {
    return `/images/home-features/${slug}.png`;
  }
}
