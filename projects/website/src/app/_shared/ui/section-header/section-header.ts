import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Section header — the kicker + H2 + optional sub-copy block that opens every
 * content band. Everything is projected so callers own their i18n and the
 * trailing period in the heading. The amber `.text-brand` accent is reserved
 * for the hero H1 — never use it in section headings:
 *
 * ```html
 * <mh-section-header center>
 *   <mh-kicker kicker tone="teal" i18n>Features</mh-kicker>
 *   <ng-container heading i18n>Everything you need to coach online.</ng-container>
 *   <ng-container sub i18n>One place for your profile, sessions, programs and payments.</ng-container>
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
