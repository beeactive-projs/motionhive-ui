import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonSpinner,
  IonText,
  NavController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, checkmarkCircleOutline, mailUnreadOutline } from 'ionicons/icons';

import { AuthService } from 'core';

export const VerifyStates = {
  Verifying: 'verifying',
  Success: 'success',
  Invalid: 'invalid',
  Missing: 'missing',
} as const;

export type VerifyState = (typeof VerifyStates)[keyof typeof VerifyStates];

/**
 * Email-verification landing page — mirrors web's /auth/verify-email.
 * Needs a `?token=` query param from the emailed link; reachable in-app
 * once deep links land. The endpoint is rate-limited at the BE, so the
 * request runs exactly once — no retry loop.
 */
@Component({
  selector: 'mh-verify-email',
  imports: [IonButton, IonContent, IonIcon, IonSpinner, IonText],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
})
export class VerifyEmail implements OnInit {
  private readonly _authService = inject(AuthService);
  private readonly _navController = inject(NavController);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  readonly VerifyStates = VerifyStates;

  readonly state = signal<VerifyState>(VerifyStates.Verifying);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string>(
    'Your email has been verified. Redirecting you to sign in…',
  );

  constructor() {
    addIcons({ alertCircleOutline, checkmarkCircleOutline, mailUnreadOutline });
  }

  ngOnInit(): void {
    const token = (this._route.snapshot.queryParamMap.get('token') ?? '').trim();
    if (!token) {
      this.state.set(VerifyStates.Missing);
      return;
    }
    this.verify(token);
  }

  goToLogin(): void {
    this._navController.navigateRoot('/auth/login');
  }

  private verify(token: string): void {
    this.state.set(VerifyStates.Verifying);
    this._authService
      .verifyEmail(token)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (res) => {
          this.state.set(VerifyStates.Success);
          // Use the BE's message verbatim when present — it
          // distinguishes "verified now" from "already verified".
          if (res?.message) this.successMessage.set(res.message);
          setTimeout(() => {
            // Skip the redirect if the user navigated away.
            if (this.state() === VerifyStates.Success) {
              this.goToLogin();
            }
          }, 2500);
        },
        error: (err) => {
          this.state.set(VerifyStates.Invalid);
          this.errorMessage.set(
            (err?.error?.message as string) ||
              'This verification link is no longer valid. Request a new one and try again.',
          );
        },
      });
  }
}
