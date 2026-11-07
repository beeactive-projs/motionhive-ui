import { Service, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, of, take, timeout } from 'rxjs';

import { AuthStore, OnboardingService, TokenService } from 'core';
import type { OnboardingState, OnboardingStep } from 'core';

import { WELCOME_STATE_TIMEOUT_MS, withoutCardSteps } from '../config/onboarding.config';

/**
 * The reader's welcome flow state for the whole app: the guard that opens the
 * flow on entry, the flow itself, the Home cards and Discover's "For you" all
 * read this one copy. Loaded once per account per app session; every
 * onboarding write hands back the new state and lands here.
 */
@Service()
export class OnboardingStateService {
  private readonly _authStore = inject(AuthStore);
  private readonly _onboardingService = inject(OnboardingService);
  private readonly _tokenService = inject(TokenService);

  private readonly _state = signal<OnboardingState | null>(null);
  /** The account the state belongs to, so a new sign in on this phone starts over. */
  private _userId: string | null = null;
  private _shownFor: string | null = null;
  private _pending: Promise<OnboardingState | null> | null = null;

  readonly state = this._state.asReadonly();

  /** Category ids the reader likes: what Discover's "For you" narrows to. */
  readonly interestIds = computed(() => this._state()?.interestIds ?? []);

  readonly trainCard = computed<OnboardingStep[]>(() => this._state()?.trainCard ?? []);
  readonly coachCard = computed<OnboardingStep[]>(() => this._state()?.coachCard ?? []);

  /**
   * The state, read once for this account. Null when it cannot be had in
   * time (offline, a slow API): the caller goes on without it.
   */
  ensureLoaded(): Promise<OnboardingState | null> {
    this._forgetOtherAccount();
    const state = this._state();
    if (state) {
      return Promise.resolve(state);
    }
    if (!this._pending) {
      this._pending = firstValueFrom(
        this._onboardingService.getState().pipe(
          take(1),
          timeout(WELCOME_STATE_TIMEOUT_MS),
          catchError(() => of(null)),
        ),
      ).then((loaded) => {
        this._pending = null;
        if (loaded) {
          this._state.set(loaded);
        }
        return loaded;
      });
    }
    return this._pending;
  }

  /** What a write sent back. */
  set(state: OnboardingState): void {
    this._userId = this._currentUserId();
    this._state.set(state);
  }

  /** Whether the flow already opened by itself this session (it does once). */
  shownThisSession(): boolean {
    const userId = this._currentUserId();
    return userId !== null && this._shownFor === userId;
  }

  markShown(): void {
    this._shownFor = this._currentUserId();
  }

  /**
   * A Home card closed for good. It goes at once; the API call follows and
   * its answer, when it comes, replaces the local guess.
   */
  dismiss(steps: OnboardingStep[]): void {
    const state = this._state();
    if (state) {
      this._state.set(withoutCardSteps(state, steps));
    }
    this._onboardingService
      .dismiss(steps)
      .pipe(take(1))
      .subscribe({
        next: (next) => this._state.set(next),
        error: () => undefined,
      });
  }

  /** The signed-in account; the stored one while the session is still restoring. */
  private _currentUserId(): string | null {
    const user = this._authStore.user();
    if (user) {
      return user.id;
    }
    return this._tokenService.getUser()?.id ?? null;
  }

  private _forgetOtherAccount(): void {
    const userId = this._currentUserId();
    if (userId === this._userId) {
      return;
    }
    this._userId = userId;
    this._state.set(null);
    this._pending = null;
  }
}
