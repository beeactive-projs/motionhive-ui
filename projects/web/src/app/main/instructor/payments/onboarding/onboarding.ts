import { Component, ChangeDetectionStrategy } from '@angular/core';
import { StripeOnboardingCard } from '../shared/stripe-onboarding-card/stripe-onboarding-card';

@Component({
  selector: 'mh-payments-onboarding',
  imports: [StripeOnboardingCard],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsOnboarding {}
