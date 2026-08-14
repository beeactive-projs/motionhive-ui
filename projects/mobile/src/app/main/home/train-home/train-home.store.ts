import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, take } from 'rxjs';

import {
  BlogPost,
  BlogService,
  ClientService,
  InstructorSearchResult,
  MyInstructor,
  MyProfile,
  ProfileService,
  SessionService,
  WorkoutLog,
  WorkoutLogService,
} from 'core';

/** One row of the "Start here" checklist. */
export interface StartStep {
  readonly id: 'profile' | 'coach';
  readonly title: string;
  readonly sub: string;
  readonly done: boolean;
  readonly route: string;
}

const BLOG_LIMIT = 3;
const COACHES_LIMIT = 3;

/**
 * Data behind the trainee home, mirroring web's `/home`.
 *
 * Each card loads independently with its own loading signal and swallows its
 * own errors into an empty state — one slow or failing call must never hold
 * the rest of the screen hostage. The global error interceptor already
 * surfaces HTTP failures, so nothing is toasted from here.
 */
@Injectable()
export class TrainHomeStore {
  private readonly _profileService = inject(ProfileService);
  private readonly _clientService = inject(ClientService);
  private readonly _blogService = inject(BlogService);
  private readonly _sessionService = inject(SessionService);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _profile = signal<MyProfile | null>(null);
  private readonly _resume = signal<WorkoutLog | null>(null);
  private readonly _myCoaches = signal<MyInstructor[]>([]);
  private readonly _suggestedCoaches = signal<InstructorSearchResult[]>([]);
  private readonly _posts = signal<BlogPost[]>([]);

  private readonly _profileLoaded = signal(false);

  private readonly _upcomingSessions = signal(0);

  readonly resume = this._resume.asReadonly();
  readonly posts = this._posts.asReadonly();
  readonly upcomingSessions = this._upcomingSessions.asReadonly();
  readonly postsLoading = signal(true);
  readonly coachesLoading = signal(true);
  readonly sessionsLoading = signal(true);

  readonly hasOwnCoaches = computed(() => this._myCoaches().length > 0);

  /** Own coaches when there are any, otherwise a discovery list. */
  readonly coaches = computed<CoachRow[]>(() =>
    this.hasOwnCoaches()
      ? this._myCoaches().slice(0, COACHES_LIMIT).map(fromMyInstructor)
      : this._suggestedCoaches().slice(0, COACHES_LIMIT).map(fromSearchResult),
  );

  readonly steps = computed<StartStep[]>(() => {
    const account = this._profile()?.account;
    return [
      {
        id: 'profile',
        title: 'Finish your profile',
        sub: 'So coaches and clients know who you are.',
        // Both, deliberately: an avatar without a claimed handle leaves the
        // profile unreachable by name.
        done: !!account?.avatarUrl && !!account?.handle,
        route: '/tabs/home/account/profile',
      },
      {
        id: 'coach',
        title: 'Find a coach for yourself',
        sub: 'Book time with someone you rate.',
        done: this.hasOwnCoaches(),
        route: '/tabs/discover',
      },
    ];
  });

  /**
   * A step's done-state is only trustworthy once its data has arrived, so the
   * panel stays hidden until then — otherwise a fully-onboarded user watches
   * their finished steps render as undone for a frame.
   */
  private readonly _stepsReady = computed(() => this._profileLoaded() && !this.coachesLoading());

  /** Hidden while loading, and permanently once every step is done. */
  readonly showSteps = computed(
    () => this._stepsReady() && this.steps().some((step) => !step.done),
  );

  load(): void {
    this._loadProfile();
    this._loadResume();
    this._loadSessions();
    this._loadCoaches();
    this._loadPosts();
  }

  refresh(done?: () => void): void {
    this.load();
    done?.();
  }

  private _loadProfile(): void {
    this._profileService
      .getMyProfile()
      .pipe(
        take(1),
        catchError(() => of(null)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((profile) => {
        this._profile.set(profile);
        this._profileLoaded.set(true);
      });
  }

  private _loadResume(): void {
    // Returns 200 with a null body when there is nothing in progress.
    this._workoutLogService
      .getInProgress()
      .pipe(
        take(1),
        catchError(() => of(null)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((log) => this._resume.set(log));
  }

  /** Counts only — the row states how many are booked, never lists them. */
  private _loadSessions(): void {
    this.sessionsLoading.set(true);
    this._sessionService
      .myCounts()
      .pipe(
        take(1),
        catchError(() => of(null)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((counts) => {
        this._upcomingSessions.set(counts?.upcoming ?? 0);
        this.sessionsLoading.set(false);
      });
  }

  private _loadCoaches(): void {
    this.coachesLoading.set(true);
    this._clientService
      .getMyInstructors()
      .pipe(
        take(1),
        catchError(() => of([])),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((rows) => {
        this._myCoaches.set(rows ?? []);
        if (rows?.length) {
          this.coachesLoading.set(false);
          return;
        }
        this._loadSuggestedCoaches();
      });
  }

  private _loadSuggestedCoaches(): void {
    this._profileService
      .discoverInstructors()
      .pipe(
        take(1),
        catchError(() => of([])),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((results) => {
        this._suggestedCoaches.set(results ?? []);
        this.coachesLoading.set(false);
      });
  }

  private _loadPosts(): void {
    this.postsLoading.set(true);
    this._blogService
      .getPosts({ page: 1, limit: BLOG_LIMIT })
      .pipe(
        take(1),
        catchError(() => of(null)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((response) => {
        this._posts.set(response?.items ?? []);
        this.postsLoading.set(false);
      });
  }
}

/** A coach as the home screen renders it, whichever source it came from. */
export interface CoachRow {
  readonly key: string;
  readonly name: string;
  readonly tag: string;
  readonly avatarUrl: string | null;
  readonly handle: string | null;
}

function fromMyInstructor(item: MyInstructor): CoachRow {
  const user = item.instructor;
  return {
    key: item.id,
    name: `${user.firstName} ${user.lastName}`.trim() || 'Coach',
    tag: item.instructorProfile?.specializations?.slice(0, 2).join(' · ') || 'Coach',
    avatarUrl: user.avatarUrl ?? null,
    handle: user.handle ?? null,
  };
}

function fromSearchResult(item: InstructorSearchResult): CoachRow {
  return {
    key: item.id,
    name: `${item.firstName} ${item.lastName}`.trim() || item.displayName || 'Coach',
    tag: item.specializations?.slice(0, 2).join(' · ') || item.city || 'Open to new clients',
    avatarUrl: item.avatarUrl ?? null,
    handle: item.handle ?? null,
  };
}
