import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Closing call-to-action band. Every marketing page ends on one. Content
 * (kicker / heading / sub / actions) is projected so callers own i18n and can
 * put the amber keyword + period in the heading.
 *
 * Variants:
 * - `amber`  — soft amber-wash, theme-aware (default; reads well light + dark)
 * - `plain`  — transparent, sits on the page background
 * - `dark`   — navy band with honeycomb watermark (use sparingly)
 */
@Component({
  selector: 'mh-cta-band',
  template: `
    <section class="cta" [class]="'cta--' + variant()">
      <div class="cta__inner">
        <ng-content select="[kicker]" />
        <h2 class="cta__h"><ng-content select="[heading]" /></h2>
        <p class="cta__sub"><ng-content select="[sub]" /></p>
        <div class="cta__actions"><ng-content select="[actions]" /></div>
      </div>
    </section>
  `,
  styleUrl: './cta-band.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CtaBand {
  readonly variant = input<'amber' | 'plain' | 'dark'>('amber');
}
