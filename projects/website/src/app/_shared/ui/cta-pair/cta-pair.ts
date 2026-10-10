import { Component } from '@angular/core';
import { LOGIN_URL, SIGNUP_URL } from 'core';

/**
 * "Log in" (ghost) + "Start free" (primary) side by side, 1fr / 1.6fr.
 * Shared by the mobile menu footer and the homepage sticky CTA bar so both
 * stay identical.
 */
@Component({
  selector: 'mh-cta-pair',
  templateUrl: './cta-pair.html',
  styleUrl: './cta-pair.scss',
})
export class CtaPair {
  protected readonly loginUrl = LOGIN_URL;
  protected readonly signupUrl = SIGNUP_URL;
}
