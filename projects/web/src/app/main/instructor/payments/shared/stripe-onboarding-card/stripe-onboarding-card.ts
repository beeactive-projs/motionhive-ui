import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  StripeOnboardingService,
  StripeAccountStatuses,
  TagSeverity,
  deriveStripeAccountStatus,
  type OnboardingStatusResponse,
} from 'core';

@Component({
  selector: 'mh-stripe-onboarding-card',
  imports: [
    RouterLink,
    ButtonModule,
    CardModule,
    TagModule,
    SkeletonModule,
    MessageModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './stripe-onboarding-card.html',
  styleUrl: './stripe-onboarding-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StripeOnboardingCard implements OnInit {
  private readonly _onboardingService = inject(StripeOnboardingService);
  private readonly _messageService = inject(MessageService);

  readonly status = signal<OnboardingStatusResponse | null>(null);
  readonly loading = signal(true);
  readonly actionLoading = signal(false);

  readonly Statuses = StripeAccountStatuses;

  ngOnInit(): void {
    this._onboardingService.getStatus().subscribe({
      next: (res) => {
        this.status.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  get accountStatus(): string {
    return deriveStripeAccountStatus(this.status()?.account);
  }

  startOnboarding(): void {
    this.actionLoading.set(true);
    const origin = window.location.origin;
    this._onboardingService
      .start({
        returnUrl: `${origin}/payments/onboarding/return`,
        refreshUrl: `${origin}/payments/onboarding/refresh`,
      })
      .subscribe({
      next: (res) => {
        window.location.href = res.url;
      },
      error: (err) => {
        this.actionLoading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to start onboarding',
        });
      },
    });
  }

  statusSeverity(): TagSeverity {
    switch (this.accountStatus) {
      case StripeAccountStatuses.Active:
        return TagSeverity.Success;
      case StripeAccountStatuses.Pending:
        return TagSeverity.Info;
      case StripeAccountStatuses.Restricted:
        return TagSeverity.Warn;
      case StripeAccountStatuses.Disconnected:
        return TagSeverity.Danger;
      default:
        return TagSeverity.Secondary;
    }
  }

  statusLabel(): string {
    switch (this.accountStatus) {
      case StripeAccountStatuses.Active:
        return 'Active';
      case StripeAccountStatuses.Pending:
        return 'Pending review';
      case StripeAccountStatuses.Restricted:
        return 'Action required';
      case StripeAccountStatuses.Disconnected:
        return 'Disconnected';
      default:
        return 'Not connected';
    }
  }
}
