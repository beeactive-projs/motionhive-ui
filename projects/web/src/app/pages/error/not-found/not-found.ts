import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { TokenService } from 'core';

/**
 * Where every unknown URL lands, signed in or not: a way back into the app
 * for members, sign in or sign up for guests.
 */
@Component({
  selector: 'mh-not-found',
  imports: [RouterLink, ButtonDirective, TranslatePipe],
  templateUrl: './not-found.html',
})
export class NotFound {
  private readonly _location = inject(Location);
  private readonly _tokenService = inject(TokenService);

  /** The same test the guards use; the auth store may not be loaded on a direct hit. */
  protected readonly isSignedIn = !!this._tokenService.getAccessToken();

  protected goBack(): void {
    this._location.back();
  }
}
