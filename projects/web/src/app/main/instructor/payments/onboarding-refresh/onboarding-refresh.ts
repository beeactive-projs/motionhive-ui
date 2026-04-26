import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { StripeOnboardingService } from 'core';

@Component({
  selector: 'mh-onboarding-refresh',
  imports: [CardModule, ProgressSpinnerModule, ButtonModule],
  templateUrl: './onboarding-refresh.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingRefresh implements OnInit {
  private readonly _onboardingService = inject(StripeOnboardingService);

  readonly redirecting = signal(true);
  readonly error = signal(false);

  ngOnInit(): void {
    this.startOnboarding();
  }

  retry(): void {
    this.redirecting.set(true);
    this.error.set(false);
    this.startOnboarding();
  }

  private startOnboarding(): void {
    const origin = window.location.origin;
    // Instructor payment routes are mounted at /coaching/onboarding/*;
    // /payments/onboarding/* doesn't exist as a route and would 404
    // after Stripe redirects back.
    this._onboardingService
      .start({
        returnUrl: `${origin}/coaching/onboarding/return`,
        refreshUrl: `${origin}/coaching/onboarding/refresh`,
      })
      .subscribe({
        next: (res) => {
          window.location.href = res.url;
        },
        error: () => {
          this.redirecting.set(false);
          this.error.set(true);
        },
      });
  }
}
