import {
  Component,
  ChangeDetectionStrategy,
  signal,
  ElementRef,
  inject,
  NgZone,
  DestroyRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { afterNextRender } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { filter, startWith, throttleTime } from 'rxjs/operators';

import { PublicHeaderComponent } from './header/header.component';
import { PublicFooterComponent } from './footer/footer.component';

/** Canonical host for the marketing site (used for canonical + hreflang URLs). */
const SITE_ORIGIN = 'https://www.motionhive.fit';

@Component({
  selector: 'mh-public-layout',
  imports: [RouterOutlet, PublicHeaderComponent, PublicFooterComponent],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // host: {
  //   '[style.--cursor-x]': 'cursorX()',
  //   '[style.--cursor-y]': 'cursorY()',
  // },
})
export class PublicLayoutComponent {
  private readonly _elementRef = inject(ElementRef);
  private readonly _ngZone = inject(NgZone);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _router = inject(Router);
  private readonly _document = inject(DOCUMENT);

  constructor() {
    // Keep <link rel="canonical"> + hreflang alternates correct per page, so
    // Google indexes both the English (/) and Romanian (/ro/) versions and maps
    // each page to its counterpart. `router.url` is already locale-independent
    // (relative to the build's base href), so the same path drives both bundles.
    const isRo = (this._document.documentElement.lang || 'en')
      .toLowerCase()
      .startsWith('ro');

    this._router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe(() => this.updateAlternateLinks(isRo));
  }

  private updateAlternateLinks(isRo: boolean): void {
    const path = (this._router.url.split('#')[0].split('?')[0] || '/');
    const suffix = path === '/' ? '/' : path; // home stays "/ro/" not "/ro"
    const enHref = SITE_ORIGIN + suffix;
    const roHref = `${SITE_ORIGIN}/ro${suffix}`;

    this.setLink('canonical', null, isRo ? roHref : enHref);
    this.setLink('alternate', 'en', enHref);
    this.setLink('alternate', 'ro', roHref);
    this.setLink('alternate', 'x-default', enHref);
  }

  private setLink(rel: string, hreflang: string | null, href: string): void {
    const selector = hreflang
      ? `link[rel="${rel}"][hreflang="${hreflang}"]`
      : `link[rel="${rel}"]`;
    let el = this._document.head.querySelector<HTMLLinkElement>(selector);
    if (!el) {
      el = this._document.createElement('link');
      el.setAttribute('rel', rel);
      if (hreflang) el.setAttribute('hreflang', hreflang);
      this._document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  // cursorX = signal('50%');
  // cursorY = signal('50%');

  // constructor() {
  //   afterNextRender(() => {
  //     this.zone.runOutsideAngular(() => {
  //       fromEvent<MouseEvent>(this.el.nativeElement, 'mousemove')
  //         .pipe(
  //           throttleTime(30, undefined, { leading: true, trailing: true }),
  //           takeUntilDestroyed(this.destroyRef),
  //         )
  //         .subscribe((e) => {
  //           this.cursorX.set(`${e.clientX}px`);
  //           this.cursorY.set(`${e.clientY}px`);
  //         });
  //     });
  //   });
  // }
}
