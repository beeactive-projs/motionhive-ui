import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import {
  ClientPaymentService,
  MyBillingCounts,
} from '../services/payment/client-payment.service';

/**
 * BillingCountsStore
 *
 * Single source of truth for "does this user have any billing, and how
 * much is outstanding". Backs two surfaces that would otherwise each hit
 * `GET /payments/my/counts` on every render:
 *   - the avatar account menu (whether to show "Billing & payments"),
 *   - the profile Billing tab (whether to render it + the open-invoice badge).
 *
 * `ensureLoaded()` is idempotent, so the persistent layout (account menu)
 * triggers exactly one request per session and every other consumer reads
 * the cached signal. Cache lifetime is the process; `reload()` forces a
 * refetch after a payment, `reset()` drops it on logout.
 */
@Injectable({ providedIn: 'root' })
export class BillingCountsStore {
  private readonly _service = inject(ClientPaymentService);

  /**
   * `undefined` = never loaded; `null` = loaded but the request failed;
   * `MyBillingCounts` = loaded. The three states let consumers tell
   * "still loading" from "definitely nothing" without a second signal.
   */
  private readonly _counts = signal<MyBillingCounts | null | undefined>(undefined);
  private readonly _loading = signal(false);

  readonly counts = this._counts.asReadonly();
  readonly loading = this._loading.asReadonly();

  /** True once we know the user has at least one invoice or membership. */
  readonly hasBilling = computed(() => {
    const c = this._counts();
    return !!c && ((c.invoices.total ?? 0) > 0 || (c.memberships.total ?? 0) > 0);
  });

  /** Open invoices needing payment — drives the Billing tab badge. */
  readonly openInvoices = computed(() => this._counts()?.invoices.open ?? 0);

  /**
   * Fetch the counts once. No-op if already loaded or a load is in
   * flight, so it's safe to call from every consumer's constructor.
   */
  ensureLoaded(): void {
    if (this._counts() !== undefined || this._loading()) return;
    this._loading.set(true);
    this._service
      .getMyCounts()
      .pipe(
        tap((res) => this._counts.set(res)),
        catchError(() => {
          // Treat a failure as "no billing" — the menu/tab simply stay
          // hidden rather than showing a broken surface. The global error
          // interceptor logs the network error.
          this._counts.set(null);
          return of(null);
        }),
      )
      .subscribe({
        complete: () => this._loading.set(false),
      });
  }

  /** Force a refetch — call after a payment or membership change. */
  reload(): void {
    this._counts.set(undefined);
    this.ensureLoaded();
  }

  /** Drop the cache. Call on logout. */
  reset(): void {
    this._counts.set(undefined);
    this._loading.set(false);
  }
}
