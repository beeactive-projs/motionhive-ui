import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, finalize, of, tap } from 'rxjs';
import { ProfileService } from '../services/profile/profile.service';
import { ProductService } from '../services/payment/product.service';
import type { PublicInstructorProfile } from '../models/client/instructor.model';
import type { Product } from '../models/payment/product.model';
import type { InstructorGroupSummary } from '../models/profile/instructor-group-summary.model';
import type {
  PaginatedReviews,
  Review,
  ReviewBreakdown,
} from '../models/review/review.model';
import type { PublicUserProfile } from '../models/profile/public-user-profile.model';

interface CachedBundle {
  userProfile: PublicUserProfile | null;
  profile: PublicInstructorProfile | null;
  offerings: Product[] | null;
  groups: InstructorGroupSummary[] | null;
  reviews: Review[];
  reviewsCursor: string | null;
  reviewsBreakdown: ReviewBreakdown | null;
}

const CACHE_LIMIT = 3;

/**
 * Single source of truth for the `/@<handle>` Public Profile page.
 *
 * Two payloads coexist:
 *   - `userProfile` — always populated when a handle resolves; covers
 *     every user (instructor or not). Drives the hero, "about" facts,
 *     and the audience badge.
 *   - `profile` — populated only when the handle belongs to an
 *     instructor. Drives the instructor-specific tabs (offerings,
 *     reviews, groups) and the side-rail pricing card.
 *
 * `load(handle)` runs both fetches in parallel for instructors so the
 * hero and tabs unblock together. A 3-entry LRU keyed by handle keeps
 * the back button instant.
 */
@Injectable({ providedIn: 'root' })
export class PublicProfileStore {
  private readonly _profileService = inject(ProfileService);
  private readonly _productService = inject(ProductService);

  private readonly _userProfile = signal<PublicUserProfile | null>(null);
  private readonly _profile = signal<PublicInstructorProfile | null>(null);
  private readonly _offerings = signal<Product[] | null>(null);
  private readonly _groups = signal<InstructorGroupSummary[] | null>(null);
  private readonly _reviews = signal<Review[]>([]);
  private readonly _reviewsCursor = signal<string | null>(null);
  private readonly _reviewsBreakdown = signal<ReviewBreakdown | null>(null);

  private readonly _loadingProfile = signal(false);
  private readonly _loadingOfferings = signal(false);
  private readonly _loadingGroups = signal(false);
  private readonly _loadingReviews = signal(false);
  private readonly _error = signal<string | null>(null);

  /** Last three loaded profiles, keyed by lowercased handle. */
  private readonly _cache = new Map<string, CachedBundle>();

  readonly userProfile = this._userProfile.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly offerings = this._offerings.asReadonly();
  readonly groups = this._groups.asReadonly();
  readonly reviews = this._reviews.asReadonly();
  readonly reviewsCursor = this._reviewsCursor.asReadonly();
  readonly reviewsBreakdown = this._reviewsBreakdown.asReadonly();

  readonly loadingProfile = this._loadingProfile.asReadonly();
  readonly loadingOfferings = this._loadingOfferings.asReadonly();
  readonly loadingGroups = this._loadingGroups.asReadonly();
  readonly loadingReviews = this._loadingReviews.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasMoreReviews = computed(() => this._reviewsCursor() !== null);
  /** True when the resolved handle is an instructor (regardless of cache). */
  readonly isInstructor = computed(
    () => !!this._userProfile()?.isInstructor,
  );

  /**
   * Load a profile by handle. Idempotent: same handle hits the cache.
   *
   * Always fetches the user-level public profile first; if the server
   * marks the account as an instructor, the instructor payload is
   * fetched in parallel for the tabs/side-rail. Non-instructor handles
   * skip the second fetch entirely.
   */
  load(handle: string): void {
    const key = handle.trim().toLowerCase();
    if (!key) return;

    const currentHandle =
      this._userProfile()?.handle?.toLowerCase() ?? null;
    if (currentHandle === key) return;

    const cached = this._cache.get(key);
    if (cached) {
      this._restoreFromCache(cached);
      return;
    }

    this._resetTabState();
    this._userProfile.set(null);
    this._profile.set(null);
    this._loadingProfile.set(true);
    this._error.set(null);

    this._profileService
      .getUserByHandle(handle)
      .pipe(
        tap((userProfile) => {
          this._userProfile.set(userProfile);
          this._cacheCurrent(key);
          if (userProfile.isInstructor) {
            this._fetchInstructorPayload(handle, key);
          }
        }),
        catchError((err: unknown) => {
          this._error.set(extractMessage(err));
          this._userProfile.set(null);
          this._profile.set(null);
          return of(null);
        }),
        finalize(() => this._loadingProfile.set(false)),
      )
      .subscribe();
  }

  /**
   * Offerings (Stripe products) are loaded lazily when the Offerings tab
   * is visited. The cache is keyed on the current profile so switching
   * profiles invalidates them automatically.
   */
  loadOfferings(): void {
    const profile = this._profile();
    if (!profile || this._offerings() !== null || this._loadingOfferings()) {
      return;
    }
    this._loadingOfferings.set(true);
    this._productService
      .listPublicForInstructor(profile.userId)
      .pipe(
        tap((items) => {
          this._offerings.set(items);
          this._cacheCurrent(this._cacheKey());
        }),
        catchError(() => {
          this._offerings.set([]);
          return of([] as Product[]);
        }),
        finalize(() => this._loadingOfferings.set(false)),
      )
      .subscribe();
  }

  loadGroups(): void {
    const profile = this._profile();
    if (!profile || this._groups() !== null || this._loadingGroups()) {
      return;
    }
    this._loadingGroups.set(true);
    this._profileService
      .getInstructorGroups(profile.userId)
      .pipe(
        tap((items) => {
          this._groups.set(items);
          this._cacheCurrent(this._cacheKey());
        }),
        catchError(() => {
          this._groups.set([]);
          return of([] as InstructorGroupSummary[]);
        }),
        finalize(() => this._loadingGroups.set(false)),
      )
      .subscribe();
  }

  /**
   * Initial reviews load + breakdown. Pass `{ append: true }` from the
   * "Load more" button to fetch the next page using the current cursor.
   */
  loadReviews(opts: { append?: boolean } = {}): void {
    const profile = this._profile();
    if (!profile || this._loadingReviews()) return;

    const append = !!opts.append;
    // First-page guard: don't refetch if we already have reviews and
    // the caller isn't asking to paginate.
    if (!append && this._reviews().length > 0) return;
    if (append && !this._reviewsCursor()) return;

    this._loadingReviews.set(true);
    this._profileService
      .getInstructorReviews(profile.userId, {
        cursor: append ? this._reviewsCursor()! : undefined,
        breakdown: !append,
        limit: 10,
      })
      .pipe(
        tap((res: PaginatedReviews) => {
          if (append) {
            this._reviews.update((existing) => [...existing, ...res.items]);
          } else {
            this._reviews.set(res.items);
            if (res.breakdown) this._reviewsBreakdown.set(res.breakdown);
          }
          this._reviewsCursor.set(res.nextCursor);
          this._cacheCurrent(this._cacheKey());
        }),
        catchError(() => of(null)),
        finalize(() => this._loadingReviews.set(false)),
      )
      .subscribe();
  }

  /** Hard reset — used on logout. Page-level cleanup uses `load(other)`. */
  reset(): void {
    this._userProfile.set(null);
    this._profile.set(null);
    this._resetTabState();
    this._error.set(null);
    this._cache.clear();
  }

  /**
   * Drop the cached payload for `handle` and, if it's the one currently
   * mounted, clear the live signals so the next `load()` re-fetches.
   * Called after the owner edits their own profile so the public view
   * picks up the change instead of serving the LRU cache.
   */
  invalidate(handle: string | null | undefined): void {
    if (!handle) return;
    const key = handle.trim().toLowerCase();
    if (!key) return;
    this._cache.delete(key);
    const currentHandle = this._userProfile()?.handle?.toLowerCase() ?? null;
    if (currentHandle === key) {
      this._userProfile.set(null);
      this._profile.set(null);
      this._resetTabState();
    }
  }

  private _fetchInstructorPayload(handle: string, key: string): void {
    this._profileService
      .getInstructorByHandle(handle)
      .pipe(
        tap((profile) => {
          this._profile.set(profile);
          this._cacheCurrent(key);
        }),
        // The user-profile call already succeeded — if the instructor
        // fetch fails we just don't render the instructor surfaces.
        catchError(() => of(null)),
      )
      .subscribe();
  }

  private _resetTabState(): void {
    this._offerings.set(null);
    this._groups.set(null);
    this._reviews.set([]);
    this._reviewsCursor.set(null);
    this._reviewsBreakdown.set(null);
  }

  private _restoreFromCache(bundle: CachedBundle): void {
    this._userProfile.set(bundle.userProfile);
    this._profile.set(bundle.profile);
    this._offerings.set(bundle.offerings);
    this._groups.set(bundle.groups);
    this._reviews.set(bundle.reviews);
    this._reviewsCursor.set(bundle.reviewsCursor);
    this._reviewsBreakdown.set(bundle.reviewsBreakdown);
    this._error.set(null);
  }

  private _cacheKey(): string {
    return this._userProfile()?.handle?.toLowerCase() ?? '';
  }

  private _cacheCurrent(key: string): void {
    const userProfile = this._userProfile();
    if (!userProfile || !key) return;
    // Touch — re-insert to move to most-recently-used position.
    this._cache.delete(key);
    this._cache.set(key, {
      userProfile,
      profile: this._profile(),
      offerings: this._offerings(),
      groups: this._groups(),
      reviews: this._reviews(),
      reviewsCursor: this._reviewsCursor(),
      reviewsBreakdown: this._reviewsBreakdown(),
    });
    while (this._cache.size > CACHE_LIMIT) {
      const oldestKey = this._cache.keys().next().value;
      if (oldestKey === undefined) break;
      this._cache.delete(oldestKey);
    }
  }
}

function extractMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const body = (err as { error?: { message?: string } }).error;
    if (body?.message) return body.message;
  }
  return 'Profile not found';
}
