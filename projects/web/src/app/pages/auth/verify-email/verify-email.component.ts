import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

// Core
import { AuthService, Logo } from 'core';
import { ThemeToggleComponent } from '../../../_shared/components/theme-toggle/theme-toggle.component';

/**
 * Email-verification landing page.
 *
 * Hit by the link the BE emails on register / resend-verification:
 *   GET /auth/verify-email?token=<sha256>
 *
 * Flow:
 *   1. Read `token` from query params.
 *   2. Call POST /auth/verify-email { token } via AuthService.
 *   3. Render one of four states:
 *      - VERIFYING: spinner while the request is in-flight (default).
 *      - SUCCESS:   "email verified" + auto-redirect to login after 2s.
 *      - INVALID:   token expired / unknown — offer "Resend" CTA back to
 *                   the profile page (only useful when authenticated;
 *                   otherwise nudge to login + resend).
 *      - MISSING:   no token in the URL at all (bad link, browser
 *                   stripped query, etc.) — explain + show login link.
 *
 * The endpoint is rate-limited at the BE (7 / 15min per IP), so a
 * paranoid retry loop here would just hit 429s. We do the request
 * exactly once and let the user click "back to login" / "resend"
 * manually if they hit an error.
 */
type VerifyState = 'verifying' | 'success' | 'invalid' | 'missing';

@Component({
  selector: 'mh-verify-email',
  imports: [
    RouterLink,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    ThemeToggleComponent,
    Logo,
  ],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailComponent implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _authService = inject(AuthService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly state = signal<VerifyState>('verifying');
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string>(
    'Your email has been verified. Redirecting you to sign in…',
  );

  ngOnInit(): void {
    this._route.queryParamMap
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((params) => {
        const token = (params.get('token') ?? '').trim();
        if (!token) {
          this.state.set('missing');
          return;
        }
        this.verify(token);
      });
  }

  private verify(token: string): void {
    this.state.set('verifying');
    this._authService
      .verifyEmail(token)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (res) => {
          this.state.set('success');
          // Use the BE's message verbatim when present — it
          // distinguishes "verified now" from "already verified".
          if (res?.message) this.successMessage.set(res.message);
          setTimeout(() => {
            // Skip the redirect if the user navigated away.
            if (this.state() === 'success') {
              void this._router.navigate(['/auth/login']);
            }
          }, 2500);
        },
        error: (err) => {
          this.state.set('invalid');
          this.errorMessage.set(
            (err?.error?.message as string) ||
              'This verification link is no longer valid. Request a new one from your profile.',
          );
        },
      });
  }
}
