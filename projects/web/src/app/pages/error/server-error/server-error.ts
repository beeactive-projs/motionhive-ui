import { Component, computed, inject } from '@angular/core';
import { Location } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';

/** HTTP status codes with their own copy; any other code gets the generic one. */
const CODES_WITH_COPY = [500, 502, 503, 504];

/** A server failure page; `?code=` picks the status shown (500 by default). */
@Component({
  selector: 'mh-server-error',
  imports: [RouterLink, ButtonDirective, TranslatePipe],
  templateUrl: './server-error.html',
})
export class ServerError {
  private readonly _activatedRoute = inject(ActivatedRoute);
  private readonly _location = inject(Location);

  private readonly _queryParams = toSignal(this._activatedRoute.queryParams, {
    initialValue: {} as Params,
  });

  protected readonly errorCode = computed(() => parseInt(this._queryParams()['code']) || 500);

  /** Key prefix of the copy for this code, e.g. `errorPages.serverError.503`. */
  protected readonly copyKey = computed(() => {
    const code = this.errorCode();
    return CODES_WITH_COPY.includes(code)
      ? `errorPages.serverError.${code}`
      : 'errorPages.serverError.default';
  });

  protected retry(): void {
    window.location.reload();
  }

  protected goBack(): void {
    this._location.back();
  }
}
