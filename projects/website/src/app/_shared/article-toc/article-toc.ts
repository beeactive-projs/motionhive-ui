import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import type { ArticleHeading } from '../article-content.util';

/**
 * "On this page" table of contents.
 *
 * - Desktop: a sticky rail in the article's right column. Anchors are plain,
 *   crawlable HTML that work with JS disabled; scroll-spy highlighting is a
 *   browser-only enhancement via an IntersectionObserver over the real
 *   heading elements.
 * - Small screens: a floating button opens a right-side drawer with the same
 *   list (the rail has no room). Tapping an entry jumps to the section and
 *   closes the drawer.
 */
@Component({
  selector: 'mh-article-toc',
  imports: [NgTemplateOutlet],
  templateUrl: './article-toc.html',
  styleUrl: './article-toc.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleToc {
  readonly headings = input.required<ArticleHeading[]>();

  private readonly _platformId = inject(PLATFORM_ID);
  readonly activeId = signal<string | null>(null);
  /** Mobile drawer open state. */
  readonly open = signal(false);

  constructor() {
    afterRenderEffect(() => {
      if (!isPlatformBrowser(this._platformId)) return;
      const headings = this.headings();
      if (!headings.length) return;

      const els = headings
        .map((h) => document.getElementById(h.id))
        .filter((el): el is HTMLElement => el !== null);
      if (!els.length) return;

      const visible = new Set<string>();
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target.id);
            else visible.delete(entry.target.id);
          }
          const current = headings.find((h) => visible.has(h.id));
          if (current) this.activeId.set(current.id);
        },
        { rootMargin: '-90px 0px -68% 0px', threshold: 0 },
      );

      els.forEach((el) => observer.observe(el));
      return () => observer.disconnect();
    });
  }

  toggle(): void {
    this.open() ? this.close() : this._open();
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this._lockScroll(false);
  }

  private _open(): void {
    this.open.set(true);
    this._lockScroll(true);
  }

  /** Smooth-scroll enhancement; the raw anchor already works without JS. */
  onClick(event: MouseEvent, id: string): void {
    if (!isPlatformBrowser(this._platformId)) return;
    const el = document.getElementById(id);
    if (!el) return;
    event.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
    this.activeId.set(id);
    this.close();
  }

  private _lockScroll(lock: boolean): void {
    if (!isPlatformBrowser(this._platformId)) return;
    document.body.style.overflow = lock ? 'hidden' : '';
  }
}
