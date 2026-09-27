import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, take } from 'rxjs';

import { ProfileService, PublicUserProfile } from 'core';

/**
 * Someone else's profile, by handle.
 *
 * The server decides what this viewer may see — OWNER, COACH or PUBLIC —
 * and nulls every field the tier does not allow. So the page renders
 * whatever came back rather than re-deciding privacy here: a second opinion
 * on the client could only ever disagree with the one that matters.
 */
@Injectable()
export class ProfileViewStore {
  private readonly _profileService = inject(ProfileService);
  /** The page's, since the page provides this store. */
  private readonly _destroyRef = inject(DestroyRef);

  private _handle = '';

  private readonly _profile = signal<PublicUserProfile | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  /** A handle that resolves to nobody, as opposed to a failed request. */
  private readonly _notFound = signal(false);

  readonly profile = this._profile.asReadonly();
  readonly notFound = this._notFound.asReadonly();

  readonly showSkeleton = computed(() => this._loading() && !this._profile());
  readonly showError = computed(() => this._error() && !this._profile());

  /** Whether anything beyond the name and avatar survived the privacy mask. */
  readonly hasDetails = computed(() => {
    const p = this._profile();
    return !!p && !!(p.city || p.email || p.phone || p.language || p.timezone);
  });

  init(handle: string): void {
    if (handle === this._handle) return;
    this._handle = handle;
    this._profile.set(null);
    this._error.set(false);
    this._notFound.set(false);
    this.load();
  }

  load(): void {
    if (!this._handle || this._loading()) return;
    this._loading.set(true);
    this._error.set(false);
    this._notFound.set(false);

    // Silent: this page reports a failed load itself, inline and with a
    // retry. The global dialog on top of that is the same failure twice.
    this._profileService
      .getUserByHandle(this._handle)
      .pipe(
        take(1),
        finalize(() => this._loading.set(false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (profile) => this._profile.set(profile),
        error: (error: unknown) => {
          // A 404 is a different story from a dead connection: one is "no
          // such person", the other is "try again".
          const status = (error as { status?: number } | null)?.status;
          if (status === 404) {
            this._notFound.set(true);
            return;
          }
          this._error.set(true);
        },
      });
  }

  retry(): void {
    this.load();
  }
}
