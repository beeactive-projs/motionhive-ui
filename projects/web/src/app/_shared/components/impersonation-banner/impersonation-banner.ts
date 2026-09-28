import {
  Component,
  inject,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { TokenService } from 'core';

/**
 * Persistent banner shown while this browser context is an admin
 * impersonation session (flagged in localStorage by the `/impersonate`
 * handoff). "Exit" clears the session and returns to login. The token is
 * short-lived and refresh-less, so it also self-expires.
 */
@Component({
  selector: 'mh-impersonation-banner',
  imports: [TranslatePipe],
  template: `
    @if (active()) {
      <div
        style="position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;justify-content:center;gap:12px;background:#b45309;color:#fff;padding:6px 12px;font-size:13px;font-weight:600;"
      >
        <span><span aria-hidden="true">⚠</span> {{ 'components.impersonationBanner.message' | translate }}</span>
        <button
          type="button"
          (click)="exit()"
          style="background:#fff;color:#b45309;border:none;border-radius:6px;padding:2px 10px;font-weight:700;cursor:pointer;"
        >
          {{ 'components.impersonationBanner.exit' | translate }}
        </button>
      </div>
    }
  `,
})
export class ImpersonationBanner {
  private readonly _tokenService = inject(TokenService);
  readonly active = signal(this.isImpersonating());

  private isImpersonating(): boolean {
    try {
      return !!localStorage.getItem('mh_impersonation');
    } catch {
      return false;
    }
  }

  exit(): void {
    this._tokenService.clearTokens();
    try {
      localStorage.removeItem('mh_impersonation');
    } catch {
      /* ignore */
    }
    window.location.assign('/auth/login');
  }
}
