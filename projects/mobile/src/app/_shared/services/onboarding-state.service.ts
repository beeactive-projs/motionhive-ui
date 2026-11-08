import { Service, computed, inject, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, of, take, timeout } from 'rxjs';

import { AuthStore, OnboardingService, TokenService } from 'core';
import type { OnboardingState, OnboardingStep } from 'core';

import {
  WELCOME_FALLBACK_URL,
  WELCOME_STATE_TIMEOUT_MS,
  welcomeLink,
  withoutCardSteps,
} from '../config/onboarding.config';

/** The state as it arrived for one account. */
interface HeldState {
  userId: string | null;
  state: OnboardingState | null;
}

/**
 * The reader's welcome flow state for the whole app: the guard that opens the
 * flow on entry, the flow itself, the Home cards and Discover's "For you" all
 * read this one copy.
 *
 * It travels with the user: `GET /users/me`, which the app loads on every
 * start anyway, carries it as `onboarding`, and the stored user it starts
 * from holds the last copy, so a cold start decides at once with no request
 * of its own. Every onboarding write hands back the new state, which lands
 * here and in that stored user, so the next start reads what was answered.
 * Only a user stored before the API sent it costs one `GET` (`ensureLoaded`).
 */
@Service()
export class OnboardingStateService {
  private readonly _authStore = inject(AuthStore);
  private readonly _onboardingService = inject(OnboardingService);
  private readonly _tokenService = inject(TokenService);
  private readonly _router = inject(Router);

  /**
   * The signed-in account and its state from the user. A user answer that
   * carries none (a profile edit, a sign in) keeps what the same account
   * had; another account starts over.
   */
  private readonly _held = linkedSignal<HeldState, HeldState>({
    source: () => ({
      userId: this._currentUserId(),
      state: this._authStore.user()?.onboarding ?? null,
    }),
    computation: (next, previous) => {
      if (next.state || !previous || previous.value.userId !== next.userId) {
        return next;
      }
      return { userId: next.userId, state: previous.value.state };
    },
  });

  private _shownFor: string | null = null;
  private _pending: Promise<OnboardingState | null> | null = null;
  private _pendingFor: string | null = null;

  readonly state = computed(() => this._held().state);

  /** Category ids the reader likes: what Discover's "For you" narrows to. */
  readonly interestIds = computed(() => this.state()?.interestIds ?? []);

  readonly trainCard = computed<OnboardingStep[]>(() => this.state()?.trainCard ?? []);
  readonly coachCard = computed<OnboardingStep[]>(() => this.state()?.coachCard ?? []);

  /**
   * The state for this account: at once when the user brought it, else read
   * once. Null when it cannot be had in time (offline, a slow API): the
   * caller goes on without it.
   */
  ensureLoaded(): Promise<OnboardingState | null> {
    const state = this.state();
    if (state) {
      return Promise.resolve(state);
    }
    const userId = this._currentUserId();
    if (!this._pending || this._pendingFor !== userId) {
      this._pendingFor = userId;
      this._pending = firstValueFrom(
        this._onboardingService.getState().pipe(
          take(1),
          timeout(WELCOME_STATE_TIMEOUT_MS),
          catchError(() => of(null)),
        ),
      ).then((loaded) => {
        this._pending = null;
        if (loaded && this._currentUserId() === userId) {
          this.set(loaded);
        }
        return loaded;
      });
    }
    return this._pending;
  }

  /** What a write sent back: here, and in the stored user the next start reads. */
  set(state: OnboardingState): void {
    this._held.set({ userId: this._currentUserId(), state });
    const user = this._authStore.user();
    if (user) {
      const next = { ...user, onboarding: state };
      this._authStore.setUser(next);
      this._tokenService.setUser(next);
    }
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
   * The flow on these steps only, as an editor (a Home card, an Account
   * row), ending on `returnUrl`: Home unless the caller says otherwise.
   */
  open(steps: readonly OnboardingStep[], returnUrl: string = WELCOME_FALLBACK_URL): void {
    const link = welcomeLink(steps, returnUrl);
    void this._router.navigate([link.path], { queryParams: link.queryParams });
  }

  /**
   * A Home card closed for good. It goes at once; the API call follows and
   * its answer, when it comes, replaces the local guess.
   */
  dismiss(steps: OnboardingStep[]): void {
    const state = this.state();
    if (state) {
      this.set(withoutCardSteps(state, steps));
    }
    this._onboardingService
      .dismiss(steps)
      .pipe(take(1))
      .subscribe({
        next: (next) => this.set(next),
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
}
