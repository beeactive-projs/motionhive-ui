import { Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService, privacyPolicyUrl, termsOfServiceUrl } from 'core';

/**
 * "By signing in, you agree to our Terms of Service and Privacy Policy." The
 * legal pages live on the marketing site only, so these link out, in the
 * language the app is showing.
 */
@Component({
  selector: 'mh-terms-notice',
  imports: [TranslatePipe],
  templateUrl: './terms-notice.html',
})
export class TermsNotice {
  private readonly _languageService = inject(LanguageService);

  /** Translation key for the sentence's opening, e.g. "By signing up, you agree to our". */
  readonly intro = input.required<string>();

  protected readonly termsUrl = termsOfServiceUrl(this._languageService.current);
  protected readonly privacyUrl = privacyPolicyUrl(this._languageService.current);
}
