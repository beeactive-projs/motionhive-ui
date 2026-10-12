import { Component, input } from '@angular/core';

import { Hex } from '../hex/hex';

/** A kicker's hue: amber for core, teal for community/social, muted for neutral or "coming soon". */
export type KickerTone = 'amber' | 'teal' | 'muted';

/**
 * Eyebrow / kicker — the small mono, uppercase pill with a hex bullet that
 * sits above a section heading, on the marketing site and the web app's guest
 * pages. The label is projected, so each app keeps its own i18n (the website's
 * `i18n` attributes, the web app's ngx-translate).
 *
 * The bullet is the shared `mh-hex` (bg=currentColor, so it takes the pill's
 * text colour); it hides below `sm`, where the pill is the whole cue.
 */
@Component({
  selector: 'mh-kicker',
  imports: [Hex],
  templateUrl: './kicker.html',
  styleUrl: './kicker.scss',
})
export class Kicker {
  readonly tone = input<KickerTone>('amber');
  /** false = just the bullet + label, no pill background. */
  readonly pill = input(true);
}
