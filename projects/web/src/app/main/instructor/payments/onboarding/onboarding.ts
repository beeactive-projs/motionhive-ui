import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StripeOnboardingCard } from '../shared/stripe-onboarding-card/stripe-onboarding-card';

@Component({
  selector: 'mh-payments-onboarding',
  imports: [StripeOnboardingCard, TranslatePipe],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class PaymentsOnboarding {}
