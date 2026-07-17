import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Section header — the kicker + H2 + optional sub-copy block that opens every
 * content band. Everything is projected so callers own their i18n and can put
 * the one amber keyword (`.text-brand`) + trailing period in the heading:
 *
 * ```html
 * <mh-section-header center>
 *   <mh-kicker kicker tone="teal" i18n>Features</mh-kicker>
 *   <ng-container heading i18n>Everything you need to <span class="text-brand">coach online.</span></ng-container>
 *   <ng-container sub i18n>One place for your storefront, sessions, programs and payments.</ng-container>
 * </mh-section-header>
 * ```
 */
@Component({
  selector: 'mh-section-header',
  template: `
    <div class="sec" [class.sec--center]="center()">
      <ng-content select="[kicker]" />
      <h2 class="sec-h"><ng-content select="[heading]" /></h2>
      <p class="sec-sub"><ng-content select="[sub]" /></p>
    </div>
  `,
  styleUrl: './section-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionHeader {
  readonly center = input(false, { transform: booleanAttribute });
}
