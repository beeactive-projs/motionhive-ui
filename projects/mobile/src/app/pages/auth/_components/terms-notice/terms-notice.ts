import { Component, inject, input } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService, privacyPolicyUrl, termsOfServiceUrl } from 'core';

/**
 * "By signing in, you agree to our Terms of Service and Privacy Policy." —
 * the web app's line under the auth forms. The legal pages live on the
 * marketing site only, so the links open it (in the app's language) outside
 * the app.
 */
@Component({
  selector: 'mh-terms-notice',
  imports: [IonButton, TranslatePipe],
  templateUrl: './terms-notice.html',
  styleUrl: './terms-notice.scss',
})
export class TermsNotice {
  private readonly _languageService = inject(LanguageService);

  /** Translation key for the sentence's opening, e.g. "By signing up, you agree to our". */
  readonly intro = input.required<string>();

  protected readonly termsUrl = termsOfServiceUrl(this._languageService.current);
  protected readonly privacyUrl = privacyPolicyUrl(this._languageService.current);
}
