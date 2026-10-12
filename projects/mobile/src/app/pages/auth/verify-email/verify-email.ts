import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { timer } from 'rxjs';
import { addIcons } from 'ionicons';
import { arrowForward } from 'ionicons/icons';

import { AuthService, VerifyEmailState, VerifyEmailStates, apiErrorMessage } from 'core';
import { GuestControls } from '../../../_shared/components/guest-controls/guest-controls';
import { Logo } from '../../../_shared/components/logo/logo';
import { Notice } from '../../../_shared/components/notice/notice';

/**
 * Email-verification landing page — mirrors web's /auth/verify-email.
 * Needs a `?token=` query param from the emailed link; reachable in-app
 * once deep links land. The endpoint is rate-limited at the BE, so the
 * request runs exactly once — no retry loop.
 */
@Component({
  selector: 'mh-verify-email',
  imports: [
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonToolbar,
    TranslatePipe,
    GuestControls,
    Logo,
    Notice,
  ],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
})
export class VerifyEmail implements OnInit {
  private readonly _authService = inject(AuthService);
  private readonly _navController = inject(NavController);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _translateService = inject(TranslateService);

  protected readonly States = VerifyEmailStates;
  protected readonly state = signal<VerifyEmailState>(VerifyEmailStates.Verifying);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string>(
    this._translateService.instant('auth.verifyEmail.verified'),
  );

  constructor() {
    addIcons({ arrowForward });
  }

  ngOnInit(): void {
    const token = (this._route.snapshot.queryParamMap.get('token') ?? '').trim();
    if (!token) {
      this.state.set(VerifyEmailStates.Missing);
      return;
    }
    this.verify(token);
  }

  protected goToLogin(): void {
    void this._navController.navigateRoot('/auth/login');
  }

  private verify(token: string): void {
    this.state.set(VerifyEmailStates.Verifying);
    this._authService
      .verifyEmail(token)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (res) => {
          this.state.set(VerifyEmailStates.Success);
          // Use the BE's message verbatim when present — it
          // distinguishes "verified now" from "already verified".
          if (res?.message) this.successMessage.set(res.message);
          timer(2500)
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe(() => this.goToLogin());
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
