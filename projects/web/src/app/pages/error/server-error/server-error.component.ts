import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Logo } from 'core';
import { ThemeToggleComponent } from '../../../_shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'mh-server-error',
  imports: [RouterLink, ButtonDirective, ThemeToggleComponent, Logo, TranslatePipe],
  templateUrl: './server-error.component.html',
  styleUrl: './server-error.component.scss',
})
export class ServerErrorComponent {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);

  private readonly _queryParams = toSignal(this._route.queryParams, { initialValue: {} as Params });

  readonly errorCode = computed(() => parseInt(this._queryParams()['code']) || 500);

  /** 500/502/503/504 have their own copy; any other code gets the generic one. */
  private readonly _copyKey = computed(() => {
    const code = this.errorCode();
    return [500, 502, 503, 504].includes(code) ? `errorPages.serverError.${code}` : 'errorPages.serverError.default';
  });

  readonly errorTitle = computed(() => this._translateService.instant(`${this._copyKey()}.title`));

  readonly errorMessage = computed(() => this._translateService.instant(`${this._copyKey()}.message`));

  goHome(): void {
    this._router.navigate(['/']);
  }

  retry(): void {
    window.location.reload();
  }

  goBack(): void {
    window.history.back();
  }
}
