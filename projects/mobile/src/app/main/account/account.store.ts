import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, take } from 'rxjs';

import {
  AccountInfo,
  AuthStore,
  InstructorProfile,
  MyProfile,
  ProfileService,
} from 'core';

/**
 * The account area's copy of `GET /profile/me`.
 *
 * Root-provided rather than component-provided like `CoachHomeStore`, because
 * the six account screens are sibling routes rather than children — a
 * component-scoped store would give each one its own instance and its own
 * request. `ensureLoaded()` makes the repeated call from every page's
 * `ngOnInit` free. Precedent: core's `StripeOnboardingStore`.
 *
 * Sheets patch optimistically and revert on failure, so the whole area reacts
 * to a save without anyone reloading a route.
 */
@Service()
export class AccountStore {
  private readonly _profileService = inject(ProfileService);
  private readonly _authStore = inject(AuthStore);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _profile = signal<MyProfile | null>(null);
  private readonly _loading = signal(false);
  private readonly _loadFailed = signal(false);
  private readonly _saving = signal(false);
  /** Shown while the uploaded picture is still round-tripping. */
  private readonly _pendingAvatarUrl = signal<string | null>(null);

  readonly profile = this._profile.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loadFailed = this._loadFailed.asReadonly();
  readonly saving = this._saving.asReadonly();

  readonly account = computed<AccountInfo | null>(() => this._profile()?.account ?? null);
  readonly instructorProfile = computed<InstructorProfile | null>(
    () => this._profile()?.instructorProfile ?? null,
  );
  /** Drives the coach-only rows — a role claim is not enough, the profile must exist. */
  readonly isInstructor = computed(() => this.instructorProfile() !== null);
  readonly avatarUrl = computed(
    () => this._pendingAvatarUrl() ?? this.account()?.avatarUrl ?? null,
  );
  readonly fullName = computed(() => {
    const account = this.account();
    if (!account) return '';
    return `${account.firstName} ${account.lastName}`.trim();
  });

  /** Idempotent — safe to call from every page's `ngOnInit`. */
  ensureLoaded(): void {
    if (this._profile() || this._loading()) return;
    this._load();
  }

  refresh(done?: () => void): void {
    this._load(done);
  }

  /** Logout — the next account must not see the previous one's profile. */
  reset(): void {
    this._profile.set(null);
    this._pendingAvatarUrl.set(null);
    this._loadFailed.set(false);
  }

  setSaving(saving: boolean): void {
    this._saving.set(saving);
  }

  setPendingAvatarUrl(url: string | null): void {
    this._pendingAvatarUrl.set(url);
  }

  patchAccount(patch: Partial<AccountInfo>): void {
    this._profile.update((profile) =>
      profile ? { ...profile, account: { ...profile.account, ...patch } } : profile,
    );
  }

  /** No-op when there is no instructor profile — nothing to merge into. */
  patchInstructor(patch: Partial<InstructorProfile>): void {
    this._profile.update((profile) =>
      profile?.instructorProfile
        ? {
            ...profile,
            instructorProfile: { ...profile.instructorProfile, ...patch },
          }
        : profile,
    );
  }

  /**
   * Push the fields the shell renders back into `AuthStore`. The home header
   * and the menu page read the name and avatar from there, so without this a
   * rename only shows up after a cold start.
   */
  syncAuthUser(): void {
    const account = this.account();
    const user = this._authStore.user();
    if (!account || !user) return;
    this._authStore.setUser({
      ...user,
      firstName: account.firstName,
      lastName: account.lastName,
      // `User.avatarUrl` is optional-string; `AccountInfo.avatarUrl` is nullable.
      avatarUrl: account.avatarUrl ?? undefined,
      handle: account.handle,
      city: account.city,
      countryCode: account.countryCode,
    });
  }

  private _load(done?: () => void): void {
    this._loading.set(true);
    this._profileService
      .getMyProfile()
      .pipe(
        take(1),
        catchError(() => of(null)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((profile) => {
        if (profile) {
          this._profile.set(profile);
          this._pendingAvatarUrl.set(null);
        }
        this._loadFailed.set(profile === null);
        this._loading.set(false);
        done?.();
      });
  }
}
