import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Eyebrow / kicker — the small mono, uppercase pill with a hex bullet that
 * sits above every section heading. Tone maps to the brand palette (amber
 * for core, teal for community/social, muted for neutral/"coming soon").
 * Label is projected so callers keep i18n on their own text.
 */
@Component({
  selector: 'mh-kicker',
  template: `<span class="kicker" [class]="'kicker--' + tone()" [class.kicker--plain]="!pill()">
    <span class="hx" aria-hidden="true"></span>
    <ng-content />
  </span>`,
  styleUrl: './kicker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Kicker {
  readonly tone = input<'amber' | 'teal' | 'muted'>('amber');
  /** false = just the bullet + label, no pill background. */
  readonly pill = input(true);
}
