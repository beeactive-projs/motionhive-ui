import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize, take } from 'rxjs';

import {
  ProfilePreviewAs,
  ProfileService,
  ProfileWorkout,
  PublicInstructorProfile,
  PublicUserProfile,
} from 'core';

import { PagedList } from '../../_shared/utils/paged-list';

/** Workouts shown per page on a profile; more come on request. */
const WORKOUTS_PAGE_SIZE = 10;

/**
 * One person's profile, by handle: who they are, what a coach offers, and
 * the workouts they let this viewer see.
 *
 * The server decides what a viewer may see (owner, coach or anyone) and
 * nulls everything else, so the page renders whatever came back rather
 * than deciding privacy again here: a second opinion on the client could
 * only ever disagree with the one that matters. The owner may preview the
 * page as their coaches see it; the server ignores that for anyone else.
 */
@Injectable()
export class PersonStore {
  private readonly _profileService = inject(ProfileService);
  /** The page's, since the page provides this store. */
  private readonly _destroyRef = inject(DestroyRef);

  private _handle = '';
  private _profileRequest: Subscription | null = null;

  private readonly _profile = signal<PublicUserProfile | null>(null);
  /**
   * Only instructors have one. It carries what the generic profile omits
   * (bio, specialisations, experience, rating), which is why `isInstructor`
   * is on the payload as a hint to come and get it.
   */
  private readonly _coachProfile = signal<PublicInstructorProfile | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  /** A handle that resolves to nobody, as opposed to a failed request. */
  private readonly _notFound = signal(false);
  private readonly _previewAs = signal<ProfilePreviewAs>('PUBLIC');

  /** The workouts this viewer may see, or would under the preview. */
  private readonly _workouts = new PagedList<ProfileWorkout>(WORKOUTS_PAGE_SIZE, (page, limit) => {
    const previewAs = this._previewAs();
    return this._profileService.getUserWorkouts(
      this._handle,
      page,
      limit,
      previewAs === 'COACH' ? previewAs : undefined,
    );
  });

  readonly profile = this._profile.asReadonly();
  readonly coachProfile = this._coachProfile.asReadonly();
  readonly notFound = this._notFound.asReadonly();
  readonly previewAs = this._previewAs.asReadonly();
  readonly workouts = this._workouts.items;
  readonly loadingWorkouts = this._workouts.loading;
  readonly hasMoreWorkouts = this._workouts.hasMore;

  readonly showSkeleton = computed(() => this._loading() && !this._profile());
  readonly showError = computed(() => this._error() && !this._profile());

  init(handle: string): void {
    if (handle === this._handle) return;
    this._handle = handle;
    this._profile.set(null);
    this._coachProfile.set(null);
    this._previewAs.set('PUBLIC');
    this.load();
  }

  /** The owner switching between "Anyone" and "Your coaches". */
  setPreviewAs(previewAs: ProfilePreviewAs): void {
    if (previewAs === this._previewAs()) return;
    this._previewAs.set(previewAs);
    this.load();
  }

  load(): void {
    if (!this._handle) return;
    // A preview switch mid-load replaces the request rather than racing it.
    this._profileRequest?.unsubscribe();
    this._loading.set(true);
    this._error.set(false);
    this._notFound.set(false);
    // A preview switch drops a page still on its way under the old one.
    this._workouts.clear();

    const handle = this._handle;
    const previewAs = this._previewAs();
    // Silent: this page reports a failed load itself, inline and with a
    // retry. The global dialog on top of that is the same failure twice.
    this._profileRequest = this._profileService
      .getUserByHandle(handle, previewAs === 'COACH' ? previewAs : undefined)
      .pipe(
        take(1),
        finalize(() => this._loading.set(false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (profile) => {
          this._profile.set(profile);
          if ((profile.workoutCount ?? 0) > 0) this._workouts.reset();
          if (profile.isInstructor && !this._coachProfile()) this._loadCoachProfile(handle);
        },
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

  /** The next page of workouts, appended. Quiet on failure: the profile still stands. */
  loadMoreWorkouts(): void {
    this._workouts.more();
  }

  /** Silent on failure: a private or missing coach profile just means no bio. */
  private _loadCoachProfile(handle: string): void {
    this._profileService
      .getInstructorByHandle(handle)
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (coach) => this._coachProfile.set(coach),
        error: () => this._coachProfile.set(null),
      });
  }
}
