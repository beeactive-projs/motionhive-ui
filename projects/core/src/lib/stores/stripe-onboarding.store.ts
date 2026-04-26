import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { OnboardingStatusResponse } from '../models/payment/stripe-account.model';
import { StripeOnboardingService } from '../services/payment/stripe-onboarding.service';

/**
 * StripeOnboardingStore
 *
 * Single source of truth for the instructor's Stripe Connect status
 * across the FE. Replaces the 6+ places that each fetched
 * `/payments/onboarding/status` independently — every dialog open,
 * every page nav, every product/invoice form. Now they read the
 * cached `status()` signal and call `ensureLoaded()` (idempotent)
 * when they want to read from the cache or trigger the first fetch.
 *
 * Cache lifetime: process — invalidated explicitly via `refresh()`
 * (force live pull from Stripe) or `reset()` (e.g. on logout). Not
 * time-based: the FE only renders payment-sensitive UI for an
 * instructor, and any state change (onboarding finished, account
 * deauthorized) flows through `refresh()` after the user returns
 * from a Stripe redirect.
 */
@Injectable({ providedIn: 'root' })
export class StripeOnboardingStore {
  private readonly _service = inject(StripeOnboardingService);

  /**
   * `undefined` = never loaded; `null` = loaded, no Stripe account.
   * `OnboardingStatusResponse` = loaded with response. The three
   * states let consumers distinguish "still loading" from "definitely
   * no account" without an extra signal.
   */
  private readonly _status = signal<OnboardingStatusResponse | null | undefined>(
    undefined,
  );
  private readonly _loading = signal(false);

  readonly status = this._status.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly hasAccount = computed(() => !!this._status()?.account);
  readonly canIssueInvoices = computed(
    () => !!this._status()?.canIssueInvoices,
  );
  readonly needsOnboardingFinish = computed(() => {
    const account = this._status()?.account;
    return !!account && !account.detailsSubmitted;
  });
  readonly defaultCurrency = computed(
    () => this._status()?.account?.defaultCurrency ?? null,
  );

  /**
   * Load the status if it hasn't been loaded yet. No-op when a load
   * is in flight or when the cache is already populated. Returns the
   * current value of the signal as a snapshot (never the observable)
   * so call sites stay synchronous.
   */
  ensureLoaded(): void {
    if (this._status() !== undefined || this._loading()) return;
    this._loading.set(true);
    this._service
      .getStatus()
      .pipe(
        tap((res) => this._status.set(res)),
        catchError(() => {
          // Treat error as "no account" so the UI can show the
          // "Set up payments" CTA instead of a broken state. The
          // network error is logged by the global error interceptor.
          this._status.set(null);
          return of(null);
        }),
      )
      .subscribe({
        complete: () => this._loading.set(false),
      });
  }

  /**
   * Force a fresh pull from Stripe via the dedicated reconcile
   * endpoint. Use after the user returns from hosted onboarding,
   * or as a manual "Refresh" action when webhooks are missed.
   */
  refresh(): void {
    this._loading.set(true);
    this._service.refreshStatus().subscribe({
      next: (res) => this._status.set(res),
      error: () => this._status.set(null),
      complete: () => this._loading.set(false),
    });
  }

  /** Drop the cache. Call on logout. */
  reset(): void {
    this._status.set(undefined);
    this._loading.set(false);
  }
}
