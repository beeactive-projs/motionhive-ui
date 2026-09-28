import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Tooltip } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Avatar } from '../../../../../_shared/components/avatar/avatar';
import {
  SubscriptionService,
  SubscriptionStatuses,
  CurrencyRonPipe,
  StatusLabelPipe,
  getSubscriptionStatusSeverity,
  showApiError,
  type Subscription,
} from 'core';
import { subscriptionPlanLabel } from '../../shared/payment-labels';

/**
 * Subscription detail page — instructor view.
 *
 * Mirrors the layout/composition of `invoice-detail` so the two pages
 * feel like siblings: hero strip with the headline metric (renewal
 * amount + cycle), a status pill, two info cards (Client, Plan), and a
 * sidebar with the period + trial info plus the cancel actions.
 *
 * We deliberately keep this component small — there's no rich event
 * stream like invoices have (no "sent", "paid", "voided" set) — so we
 * skip the tracker and activity feed and let the period + cancel state
 * do the storytelling.
 */
@Component({
  selector: 'mh-subscription-detail',
  imports: [
    DatePipe,
    RouterLink,
    ButtonDirective,
    InputText,
    TagModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    Tooltip,
    CurrencyRonPipe,
    StatusLabelPipe,
    Avatar,
    TranslatePipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './subscription-detail.html',
  styleUrl: './subscription-detail.scss',
})
export class SubscriptionDetail implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _subscriptionService = inject(SubscriptionService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _translateService = inject(TranslateService);

  readonly subscription = signal<Subscription | null>(null);
  readonly loading = signal(true);
  readonly actionLoading = signal(false);

  readonly Statuses = SubscriptionStatuses;
  readonly statusSeverity = getSubscriptionStatusSeverity;

  /** "Personal trainings stuff · every 2 months" or fallback. */
  readonly planLabel = computed(() => {
    const sub = this.subscription();
    return sub ? subscriptionPlanLabel(sub) : '';
  });

  readonly clientName = computed(() => {
    const c = this.subscription()?.client;
    if (!c) return this._translateService.instant('payments.common.unknownClient');
    if (c.firstName) return `${c.firstName}${c.lastName ? ' ' + c.lastName : ''}`;
    return c.email;
  });

  /** True for ACTIVE / TRIALING — only those expose the cancel buttons. */
  readonly canCancel = computed(() => {
    const s = this.subscription()?.status;
    return s === SubscriptionStatuses.Active || s === SubscriptionStatuses.Trialing;
  });

  /**
   * True only when "Cancel at period end" is still meaningful. If the
   * subscription already has `cancelAt` set, that action would be a
   * no-op so we hide it — only "Cancel immediately" stays available.
   */
  readonly canScheduleCancel = computed(() => {
    const sub = this.subscription();
    return this.canCancel() && !sub?.cancelAt;
  });

  /** True when the sub is waiting on the client to save a card. */
  readonly isPendingSetup = computed(() => {
    return this.subscription()?.status === SubscriptionStatuses.Incomplete;
  });

  /** Setup link held in memory after a `getSetupLink` round-trip. */
  readonly setupUrl = signal<string | null>(null);
  readonly setupLinkLoading = signal(false);

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this.goBackToList();
      return;
    }
    this.load(id);
  }

  goBackToList(): void {
    this._router.navigate(['/coaching/payments'], {
      queryParams: { tab: 'memberships' },
    });
  }

  private load(id: string): void {
    this.loading.set(true);
    this._subscriptionService.get(id).subscribe({
      next: (sub) => {
        this.subscription.set(sub);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('toast.summary.error'),
          this._translateService.instant('payments.subscriptionDetail.toast.notFound'),
          err,
        );
        this.goBackToList();
      },
    });
  }

  /** Schedule cancel at period end — client keeps access until then. */
  confirmCancelAtEnd(): void {
    const sub = this.subscription();
    if (!sub) return;
    this._confirmationService.confirm({
      message: this._translateService.instant('payments.subscriptionDetail.confirm.cancelAtEnd.message'),
      header: this._translateService.instant('payments.subscriptionDetail.confirm.cancelAtEnd.header'),
      icon: 'pi pi-info-circle',
      accept: () => this.runCancel(sub.id, false),
    });
  }

  /** Cancel right now — useful for refunds/exits. */
  confirmCancelImmediately(): void {
    const sub = this.subscription();
    if (!sub) return;
    this._confirmationService.confirm({
      message: this._translateService.instant('payments.subscriptionDetail.confirm.cancelImmediately.message'),
      header: this._translateService.instant('payments.subscriptionDetail.confirm.cancelImmediately.header'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.runCancel(sub.id, true),
    });
  }

  /** Pull a fresh setup URL from the backend so we can copy/open it. */
  fetchSetupLink(): void {
    const sub = this.subscription();
    if (!sub) return;
    this.setupLinkLoading.set(true);
    this._subscriptionService.getSetupLink(sub.id).subscribe({
      next: (res) => {
        this.setupLinkLoading.set(false);
        if (res.url) {
          this.setupUrl.set(res.url);
        } else {
          // Subscription has moved past INCOMPLETE — refresh to show
          // the new state (e.g. the client just paid via Stripe email).
          this._messageService.add({
            severity: 'info',
            summary: this._translateService.instant('payments.subscriptionDetail.toast.alreadyActivated.summary'),
            detail: this._translateService.instant('payments.subscriptionDetail.toast.alreadyActivated.detail'),
          });
          this.load(sub.id);
        }
      },
      error: (err) => {
        this.setupLinkLoading.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('toast.summary.error'),
          this._translateService.instant('payments.subscriptionDetail.toast.setupLinkFailed'),
          err,
        );
      },
    });
  }

  copySetupLink(): void {
    const url = this.setupUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () =>
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('toast.summary.copied'),
          detail: this._translateService.instant('payments.subscriptionDetail.toast.setupLinkCopied'),
        }),
      () =>
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('payments.common.copyFailed'),
          detail: this._translateService.instant('payments.common.copyManually'),
        }),
    );
  }

  openSetupLink(): void {
    const url = this.setupUrl();
    if (url) window.open(url, '_blank', 'noopener');
  }

  private runCancel(id: string, immediate: boolean): void {
    this.actionLoading.set(true);
    this._subscriptionService.cancel(id, { immediate }).subscribe({
      next: (updated) => {
        this.subscription.set(updated);
        this.actionLoading.set(false);
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant(
            immediate
              ? 'payments.subscriptionDetail.toast.cancelled'
              : 'payments.subscriptionDetail.toast.cancellationScheduled',
          ),
        });
      },
      error: (err) => {
        this.actionLoading.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('toast.summary.error'),
          this._translateService.instant('payments.subscriptionDetail.toast.cancelFailed'),
          err,
        );
      },
    });
  }
}
