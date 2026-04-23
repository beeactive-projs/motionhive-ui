import { Component, ChangeDetectionStrategy, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { StripeOnboardingService, deriveStripeAccountStatus, StripeAccountStatuses } from 'core';

@Component({
  selector: 'mh-onboarding-return',
  imports: [CardModule, ProgressSpinnerModule, ButtonModule, TagModule],
  templateUrl: './onboarding-return.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingReturn implements OnInit, OnDestroy {
  private readonly _onboardingService = inject(StripeOnboardingService);
  private readonly _router = inject(Router);

  readonly checking = signal(true);
  readonly ready = signal(false);
  readonly pending = signal(false);
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _pollCount = 0;

  ngOnInit(): void {
    this.pollStatus();
  }

  ngOnDestroy(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
    }
  }

  private pollStatus(): void {
    this._pollTimer = setInterval(() => {
      this._pollCount++;
      this._onboardingService.getStatus().subscribe({
        next: (res) => {
          const derivedStatus = deriveStripeAccountStatus(res.account);
          if (res.canIssueInvoices || derivedStatus === StripeAccountStatuses.Active) {
            this.checking.set(false);
            this.ready.set(true);
            if (this._pollTimer) clearInterval(this._pollTimer);
            // Auto-redirect to the payments dashboard after a brief success pause
            setTimeout(() => this._router.navigate(['/coaching/payments']), 2500);
          } else if (this._pollCount >= 7) {
            // After ~10.5s, stop polling and show pending state
            this.checking.set(false);
            this.pending.set(true);
            if (this._pollTimer) clearInterval(this._pollTimer);
          }
        },
        error: () => {
          if (this._pollCount >= 7) {
            this.checking.set(false);
            this.pending.set(true);
            if (this._pollTimer) clearInterval(this._pollTimer);
          }
        },
      });
    }, 1500);
  }

  goToPayments(): void {
    this._router.navigate(['/coaching/payments']);
  }
}
