import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, take, tap } from 'rxjs';

import { AuthStore, CreateVenuePayload, UpdateVenuePayload, Venue, VenueService } from 'core';

/**
 * The places the signed-in coach works from (gyms, studios, online), as the
 * welcome flow's coach step and the coaching profile both show and edit them.
 *
 * One list for both screens, so a place added in the flow is already on the
 * profile. Loaded once per account (`ensureLoaded`); a failure says so in
 * `failed` and the next `ensureLoaded` or `reload` tries again. Writes go to
 * the API first and land in the list on success: a place is never shown as
 * saved before the server has it, since the profile and Discover read it.
 */
@Injectable({ providedIn: 'root' })
export class CoachVenuesStore {
  private readonly _venueService = inject(VenueService);
  private readonly _authStore = inject(AuthStore);

  private readonly _venues = signal<Venue[]>([]);
  private readonly _loaded = signal(false);
  private readonly _loading = signal(false);
  private readonly _failed = signal(false);
  /** Whose list is held: another account signing in on this phone starts empty. */
  private _ownerId: string | null = null;

  readonly venues = this._venues.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly failed = this._failed.asReadonly();

  /** The places shown on the profile: archived ones (web only) stay off it. */
  readonly active = computed(() => this._venues().filter((venue) => venue.isActive));

  ensureLoaded(): void {
    const ownerId = this._currentUserId();
    if (ownerId !== this._ownerId) {
      this._ownerId = ownerId;
      this._venues.set([]);
      this._loaded.set(false);
    }
    if (this._loaded() || this._loading()) {
      return;
    }
    this._load();
  }

  /** Ask the API again: the retry on a failed load. */
  reload(): void {
    this._loaded.set(false);
    this._ownerId = this._currentUserId();
    if (this._loading()) {
      return;
    }
    this._load();
  }

  create(payload: CreateVenuePayload): Observable<Venue> {
    return this._venueService.create(payload).pipe(
      take(1),
      tap((venue) => this._venues.update((venues) => [...venues, venue])),
    );
  }

  update(id: string, payload: UpdateVenuePayload): Observable<Venue> {
    return this._venueService.update(id, payload).pipe(
      take(1),
      tap((venue) => this._venues.update((venues) => replaceById(venues, venue))),
    );
  }

  remove(id: string): Observable<void> {
    return this._venueService.remove(id).pipe(
      take(1),
      tap(() => this._venues.update((venues) => venues.filter((entry) => entry.id !== id))),
    );
  }

  private _load(): void {
    this._loading.set(true);
    this._failed.set(false);
    const ownerId = this._ownerId;
    this._venueService
      .list({ silent: true })
      .pipe(take(1))
      .subscribe({
        next: (venues) => {
          this._loading.set(false);
          // Signed out (or into another account) while it loaded: not theirs.
          if (ownerId !== this._currentUserId()) {
            return;
          }
          this._venues.set(venues);
          this._loaded.set(true);
        },
        error: () => {
          this._loading.set(false);
          this._failed.set(true);
        },
      });
  }

  private _currentUserId(): string | null {
    const user = this._authStore.user();
    if (!user) {
      return null;
    }
    return user.id;
  }
}

/** The list with `venue` in its place, the rest untouched. */
function replaceById(venues: readonly Venue[], venue: Venue): Venue[] {
  const next: Venue[] = [];
  for (const entry of venues) {
    if (entry.id === venue.id) {
      next.push(venue);
    } else {
      next.push(entry);
    }
  }
  return next;
}
