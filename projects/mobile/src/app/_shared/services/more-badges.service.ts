import { Service, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import {
  AppModeStore,
  AuthStore,
  ClientPaymentService,
  ClientService,
  EarningsService,
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
 * The attention state behind the tab bar: the bill dot on the Menu tab
 * (shared with the menu page's row, so the two can never disagree), the
 * request count on the Clients tab, and the overdue dot on the coach's
 * Payments row.
 */
@Service()
export class MoreBadgesService {
  private readonly _authStore = inject(AuthStore);
  private readonly _appModeStore = inject(AppModeStore);
  private readonly _clientPaymentService = inject(ClientPaymentService);
  private readonly _clientService = inject(ClientService);
  private readonly _earningsService = inject(EarningsService);

  private readonly _openInvoices = signal(0);
  private readonly _overdueInvoices = signal(0);
  private readonly _pendingRequests = signal(0);
  private readonly _coachInvites = signal(0);

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
   * Whether a client's invoice is past its due date — the dot on the coach's
   * Payments row in the Menu, now that Home no longer shows money. The row
   * only, never the tab: the coach looks for it when they go to chase it.
   */
  readonly hasOverdueInvoices = computed(
    () => this._mode() === NavModes.Coach && this._overdueInvoices() > 0,
  );

  /**
   * How many client requests are waiting on the coach's answer — the badge on
   * the Clients tab, where they are answered. Incoming only: an invitation
   * the coach sent is waiting on someone else, and counting it lit the badge
   * for nothing to do. Zero outside coach mode.
   */
  readonly pendingRequests = computed(() =>
    this._mode() === NavModes.Coach ? this._pendingRequests() : 0,
  );

  /**
   * Whether a coach has invited this reader and is waiting — the dot on the
   * Menu's Coaches row, which is the only place on mobile an invitation can
   * be answered.
   *
   * The count's `invitations`, not `incoming`: `incoming` is trainees asking
   * a coach, so it is always zero for a trainee, and for a coach who is also
   * someone's client the two are different people waiting on different
   * screens. Train mode only. A dot rather than a count — the point is only
   * that something is waiting.
   */
  readonly hasCoachInvites = computed(
    () => this._mode() === NavModes.Train && this._coachInvites() > 0,
  );

  refresh(): void {
    this.refreshOpenInvoices();
    this.refreshOverdueInvoices();
    this.refreshPendingRequests();
  }

  /** Coach mode only: the summary is a coach's read, and only they see the row. */
  refreshOverdueInvoices(): void {
    if (this._mode() !== NavModes.Coach) return;
    this._earningsService
      .getSummary({ silent: true })
      .pipe(take(1))
      .subscribe({
        next: (summary) => this._overdueInvoices.set(summary.overdueInvoiceCount),
        error: () => this._overdueInvoices.set(0),
      });
  }

  refreshOpenInvoices(): void {
    this._clientPaymentService
      .getMyCounts({ silent: true })
      .pipe(take(1))
      .subscribe({
        next: (counts) => this._openInvoices.set(counts.invoices.open),
        error: () => this._openInvoices.set(0),
      });
  }

  /**
   * Both roles have requests waiting on them: a coach has trainees asking,
   * a trainee has coaches inviting. One read answers both (the API opened the
   * route to every account and scopes it to the caller), and the mode gates
   * live on the two computeds above, so switching mode needs no new request.
   */
  refreshPendingRequests(force = false): void {
    if (this._pendingInFlight) return;
    if (!force && Date.now() - this._pendingFetchedAt < PENDING_FRESH_MS) return;

    this._pendingInFlight = true;
    this._clientService
      .getPendingRequestsCount()
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this._pendingRequests.set(response.incoming);
          // Absent from an API older than the field: no dot, not a broken one.
          this._coachInvites.set(response.invitations ?? 0);
          this._pendingFetchedAt = Date.now();
          this._pendingInFlight = false;
        },
        // Not timestamped: a failure is not an answer, so the next caller
        // should be allowed to try rather than reuse a zero.
        error: () => {
          this._pendingRequests.set(0);
          this._coachInvites.set(0);
          this._pendingInFlight = false;
        },
      });
  }
}
