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
 * How long an unforced caller will reuse the last request count. Long enough
 * to cover an app start and the page entry that follows it, short enough
 * that nothing on screen is visibly behind.
 */
const PENDING_FRESH_MS = 5000;

/**
 * The attention state behind the Menu tab, shared between the tab bar's dot
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

  /**
   * The tab shell asks for the request count when the app starts and the
   * Clients page asks again as it enters, within a few hundred milliseconds
   * — two requests for a number that had no chance to change between them.
   * Neither caller is wrong, so the coalescing lives here: a fetch already
   * in flight is joined, and a fresh answer is reused.
   *
   * `force` is for the moments the count demonstrably just changed — an
   * invitation sent or withdrawn, leaving the Clients stack after answering
   * a request — and skips the freshness check but never the in-flight one.
   */
  private _pendingInFlight = false;
  private _pendingFetchedAt = 0;

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
   * Whether the coach has client requests waiting — the one thing in the menu
   * that is someone else waiting on them.
   */
  readonly hasPendingRequests = computed(
    () => this._mode() === NavModes.Coach && this._pendingRequests() > 0,
  );

  /**
   * The raw count, for the one screen that names it out loud: the Clients
   * tab's hourglass reads "Requests, 3 pending". It is mode-blind on purpose
   * — only a coach's screen asks for it, and the gate belongs on the dot.
   *
   * Exposed so the Clients tab can read this count rather than fetch its own.
   * Two owners meant two `/clients/requests/pending/count` calls on every
   * load of that tab, and two numbers that could disagree mid-flight.
   */
  readonly pendingRequests = this._pendingRequests.asReadonly();

  /** Something is in the menu — which thing decides what the dot announces. */
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
  refreshPendingRequests(force = false): void {
    if (!this._authStore.isInstructor()) return;
    if (this._pendingInFlight) return;
    if (!force && Date.now() - this._pendingFetchedAt < PENDING_FRESH_MS) return;

    this._pendingInFlight = true;
    this._clientService
      .getPendingRequestsCount()
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this._pendingRequests.set(response.count);
          this._pendingFetchedAt = Date.now();
          this._pendingInFlight = false;
        },
        // Not timestamped: a failure is not an answer, so the next caller
        // should be allowed to try rather than reuse a zero.
        error: () => {
          this._pendingRequests.set(0);
          this._pendingInFlight = false;
        },
      });
  }
}
