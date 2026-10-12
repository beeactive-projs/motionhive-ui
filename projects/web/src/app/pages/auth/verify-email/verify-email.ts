import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { timer } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { ProgressSpinner } from 'primeng/progressspinner';
import { AuthService, VerifyEmailState, VerifyEmailStates, apiErrorMessage } from 'core';
import { AuthHeader } from '../_components/auth-header/auth-header';

/**
 * Where the link from the register / resend-verification email lands
 * (`?token=`). Verifies once: the endpoint is rate limited (7 per 15 min per
 * IP), so a retry loop would only collect 429s. On success it redirects to
 * sign in; on failure the user asks for a new email from their profile.
 */
@Component({
  selector: 'mh-verify-email',
  imports: [RouterLink, TranslatePipe, ButtonDirective, Message, ProgressSpinner, AuthHeader],
  templateUrl: './verify-email.html',
})
export class VerifyEmail implements OnInit {
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);
  private readonly _translateService = inject(TranslateService);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly States = VerifyEmailStates;
  protected readonly state = signal<VerifyEmailState>(VerifyEmailStates.Verifying);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const token = (this._activatedRoute.snapshot.queryParamMap.get('token') ?? '').trim();
    if (!token) {
      this.state.set(VerifyEmailStates.Missing);
      return;
    }

    this._authService
      .verifyEmail(token)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.state.set(VerifyEmailStates.Success);
          timer(2500)
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe(() => void this._router.navigate(['/auth/login']));
        },
        error: (err) => {
          this.state.set(VerifyEmailStates.Invalid);
          this.errorMessage.set(
            apiErrorMessage(err, this._translateService.instant('auth.verifyEmail.invalidDefault')),
          );
        },
      });
  }
}
