import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Fixed reading-progress bar for long-form pages. Purely decorative
 * (browser-only, `aria-hidden`) so it carries no SEO weight and never
 * runs during prerender. Tracks scroll through `target` when given
 * (the article body), else the whole document.
 */
@Component({
  selector: 'mh-reading-progress',
  template: `<div class="bar" [style.transform]="'scaleX(' + progress() + ')'"></div>`,
  styleUrl: './reading-progress.scss',
  host: { 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadingProgress {
  /** Element whose scroll range maps to 0→100%. Defaults to the document. */
  readonly target = input<HTMLElement | null>(null);

  private readonly _platformId = inject(PLATFORM_ID);
  readonly progress = signal(0);

  constructor() {
    afterRenderEffect(() => {
      if (!isPlatformBrowser(this._platformId)) return;

      const compute = () => {
        const el = this.target();
        let pct: number;
        if (el) {
          const start = el.offsetTop;
          const end = el.offsetTop + el.offsetHeight - window.innerHeight;
          pct = (window.scrollY - start) / Math.max(1, end - start);
        } else {
          const doc = document.documentElement;
          pct = doc.scrollTop / Math.max(1, doc.scrollHeight - doc.clientHeight);
        }
        this.progress.set(Math.min(1, Math.max(0, pct)));
      };

      compute();
      window.addEventListener('scroll', compute, { passive: true });
      window.addEventListener('resize', compute);
      return () => {
        window.removeEventListener('scroll', compute);
        window.removeEventListener('resize', compute);
      };
    });
  }
}
