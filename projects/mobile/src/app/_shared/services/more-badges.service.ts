import { Service, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import {
  AppModeStore,
  AuthStore,
  ClientPaymentService,
  ClientService,
  NavModes,
} from 'core';

import { resolveMode } from '../config/tabs.config';

/**
 * The attention state behind the More tab, shared between the tab bar's dot
 * and the menu page's per-row dots so the two can never disagree.
 *
 * Holds counts, exposes booleans: a dot only has to say "something is in
 * here", and a number would overstate it.
 */
@Service()
export class MoreBadgesService {
  private readonly _authStore = inject(AuthStore);
  private readonly _appModeStore = inject(AppModeStore);
  private readonly _clientPaymentService = inject(ClientPaymentService);
  private readonly _clientService = inject(ClientService);

  private readonly _openInvoices = signal(0);
  private readonly _pendingRequests = signal(0);

  private readonly _mode = computed(() =>
    resolveMode(this._authStore.isInstructor(), this._appModeStore.mode()),
  );

  /**
   * Whether the trainee has a bill waiting. Only they get the dot: a client
   * has to be interrupted by a bill, where a coach chases money deliberately
   * and does not need their own app nagging them about it.
   */
  readonly hasBillDue = computed(
    () => this._mode() === NavModes.Train && this._openInvoices() > 0,
  );

  /**
   * Whether the coach has client requests waiting — the one thing in More
   * that is someone else waiting on them.
   */
  readonly hasPendingRequests = computed(
    () => this._mode() === NavModes.Coach && this._pendingRequests() > 0,
  );

  /** Something is in More — which thing decides what the dot announces. */
  readonly moreDotLabel = computed(() =>
    this.hasBillDue() ? 'You have a bill due' : 'You have client requests waiting',
  );

  refresh(): void {
    this.refreshOpenInvoices();
    this.refreshPendingRequests();
  }

  refreshOpenInvoices(): void {
    this._clientPaymentService
      .getMyCounts()
      .pipe(take(1))
      .subscribe({
        next: (counts) => this._openInvoices.set(counts.invoices.open),
        error: () => this._openInvoices.set(0),
      });
  }

  /** Only a coach can have requests; anyone else keeps the count at zero. */
  refreshPendingRequests(): void {
    if (!this._authStore.isInstructor()) return;
    this._clientService
      .getPendingRequestsCount()
      .pipe(take(1))
      .subscribe({
        next: (response) => this._pendingRequests.set(response.count),
        error: () => this._pendingRequests.set(0),
      });
  }
}
