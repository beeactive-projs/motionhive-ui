import { Component, booleanAttribute, input } from '@angular/core';
import { LOGIN_URL, SIGNUP_URL } from 'core';

/**
 * "Log in" (ghost) + "Start free" (primary). Side by side, 1fr / 1.6fr, by
 * default; `stacked` puts "Start free" on top and both full width, for narrow
 * spots where a long label (Romanian "Autentifică-te") can't share the row.
 * Shared by the mobile menu footer and the homepage sticky CTA bar.
 */
@Component({
  selector: 'mh-cta-pair',
  templateUrl: './cta-pair.html',
  styleUrl: './cta-pair.scss',
  host: { '[class.is-stacked]': 'stacked()' },
})
export class CtaPair {
  readonly stacked = input(false, { transform: booleanAttribute });

  protected readonly loginUrl = LOGIN_URL;
  protected readonly signupUrl = SIGNUP_URL;
}
