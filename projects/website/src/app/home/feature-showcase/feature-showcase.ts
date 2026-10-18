import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
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
 * The panel plays that feature's demo clip, under the same rules the rest of
 * the site follows after the speed work: `preload="none"`, the poster only
 * once the section is about a screen away, and playback only while the clip
 * is actually visible. One clip is in flight at a time because only one panel
 * exists, so switching tabs costs a new request rather than eight upfront.
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

  private readonly _elementRef = inject(ElementRef<HTMLElement>);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _video = viewChild<ElementRef<HTMLVideoElement>>('vid');
  private readonly _tabs = viewChild<ElementRef<HTMLElement>>('tabs');

  /** Index of the open feature. Starts on the first, never empty. */
  readonly active = signal(0);

  /** Only true once the section is roughly a screen away: see the comment above. */
  readonly near = signal(false);

  readonly current = computed(() => this.features()[this.active()] ?? this.features()[0]);

  /** "1 / 8" over the clip, so the row reads as a set rather than a scroll. */
  readonly position = computed(() => `${this.active() + 1} / ${this.features().length}`);

  readonly canPrev = computed(() => this.active() > 0);
  readonly canNext = computed(() => this.active() < this.features().length - 1);

  constructor() {
    // Nothing about the clip is fetched until the section is close. Matches
    // mh-media-demo, which is what kept the first screen cheap on a phone.
    afterNextRender(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          this.near.set(true);
          observer.disconnect();
        },
        { rootMargin: '100% 0px' },
      );
      observer.observe(this._elementRef.nativeElement);
      this._destroyRef.onDestroy(() => observer.disconnect());
    });

    // Plays only while a quarter of the clip is on screen. Browser-only:
    // calling play() during prerender throws.
    //
    // `near()` is read first on purpose: the <video> is behind that @if, so
    // without the explicit dependency this effect settles while the element
    // is still absent and never re-runs once it appears.
    afterRenderEffect((onCleanup) => {
      if (!this.near()) return;
      const el = this._video()?.nativeElement;
      if (!el) return;
      el.muted = true;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      let visible = false;
      const play = (): void => {
        if (visible) void el.play().catch(() => undefined);
      };
      const observer = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          if (visible) play();
          else el.pause();
        },
        { threshold: 0.25 },
      );
      observer.observe(el);
      el.addEventListener('canplay', play);
      onCleanup(() => {
        observer.disconnect();
        el.removeEventListener('canplay', play);
      });
    });
  }

  select(index: number): void {
    const last = this.features().length - 1;
    this.active.set(Math.min(Math.max(index, 0), last));
    this._scrollTabIntoView();
  }

  step(delta: number): void {
    this.select(this.active() + delta);
  }

  /** Keeps the chosen tab visible when the arrows move past the fold. */
  private _scrollTabIntoView(): void {
    const row = this._tabs()?.nativeElement;
    const tab = row?.children.item(this.active());
    tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  /** Still shown behind the clip, and alone where a feature has no video. */
  shotFor(slug: string): string {
    return `/images/home-features/${slug}.png`;
  }
}
