import { Component, afterRenderEffect, computed, inject, input, signal } from '@angular/core';

import { CtaPair } from '../ui/cta-pair/cta-pair';
import { MobileMenuService } from '../mobile-menu.service';

/**
 * Bottom CTA bar for phones (hidden from 768px up). It slides in once the
 * `start` element (the hero with the main sign-up button) has fully left the
 * screen, and steps aside while the `end` element (the closing CTA band) is
 * on screen or the mobile menu is open. Visibility comes from an
 * IntersectionObserver, never a scroll listener.
 */
@Component({
  selector: 'mh-sticky-cta',
  imports: [CtaPair],
  templateUrl: './sticky-cta.html',
  styleUrl: './sticky-cta.scss',
  host: {
    role: 'region',
    '[attr.aria-label]': 'label',
    '[class.is-visible]': 'visible()',
    '[attr.aria-hidden]': 'visible() ? null : "true"',
    '[attr.inert]': 'visible() ? null : ""',
  },
})
export class StickyCta {
  private readonly _mobileMenuService = inject(MobileMenuService);

  readonly start = input<Element>();
  readonly end = input<Element>();

  protected readonly label = $localize`:@@stickyCta.aria:Sign up`;

  // Assume both on screen until the observer reports, so the bar starts hidden.
  private readonly _startOnScreen = signal(true);
  private readonly _endOnScreen = signal(false);

  protected readonly visible = computed(
    () => !this._startOnScreen() && !this._endOnScreen() && !this._mobileMenuService.isOpen()
  );

  constructor() {
    afterRenderEffect((onCleanup) => {
      const start = this.start();
      const end = this.end();
      if (!start || !end) return;
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const onScreen = entry.target === start ? this._startOnScreen : this._endOnScreen;
          onScreen.set(entry.isIntersecting);
        }
      });
      observer.observe(start);
      observer.observe(end);
      onCleanup(() => observer.disconnect());
    });
  }
}
