import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';

import { AuthStore, WaitlistService } from 'core';
import { StripeOnboardingCard } from '../payments/shared/stripe-onboarding-card/stripe-onboarding-card';

@Component({
  selector: 'mh-dashboard',
  imports: [RouterLink, AvatarModule, ButtonModule, CardModule, DividerModule, TagModule, StripeOnboardingCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  protected readonly _authStore = inject(AuthStore);
  private readonly _waitlistService = inject(WaitlistService);

  openJoinWaitlist(): void {
    this._waitlistService.open('dashboard');
  }
}
