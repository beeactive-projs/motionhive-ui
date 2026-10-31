import { Service, Signal, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { AuthStore, ProfileService } from 'core';

import { DiscoverRecent, parseRecents, pushRecent } from './discover.config';

const CITY_KEY = 'motionhive_discover_city';
const RECENT_KEY = 'motionhive_discover_recent';

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode): the choice lasts this visit.
  }
}

/**
 * What Discover remembers about the reader, shared by the tab and by the
 * search screen wherever it is mounted:
 *
 * - the city picked in the band's sheet, kept on this phone (per account, so
 *   a shared phone does not hand one person's city to the next);
 * - the city on the reader's account, read once per app run from the
 *   profile (`GET /users/me` does not carry it). Silent: Discover works
 *   without it, falling back to every city;
 * - search's Recent list, on this phone too.
 *
 * Every storage call is guarded: a private window or blocked storage only
 * means nothing is remembered.
 */
@Service()
export class DiscoverPrefs {
  private readonly _authStore = inject(AuthStore);
  private readonly _profileService = inject(ProfileService);

  private readonly _userKey = computed(() => this._authStore.user()?.id ?? 'anonymous');

  /** Bumped on every write, so the reads below re-run. */
  private readonly _version = signal(0);

  private readonly _accountCity = signal<string | null>(null);
  private readonly _accountCityLoaded = signal(false);
  private _accountCityFor: string | null = null;

  /** The stored pick: a city key, `EVERYWHERE`, or null for never picked. */
  readonly chosenCity: Signal<string | null> = computed(() => {
    this._version();
    const value = read(`${CITY_KEY}.${this._userKey()}`);
    return typeof value === 'string' && value !== '' ? value : null;
  });

  readonly accountCity = this._accountCity.asReadonly();
  /** True once the account's city has been read (or failed to be). */
  readonly accountCityLoaded = this._accountCityLoaded.asReadonly();

  readonly recents: Signal<DiscoverRecent[]> = computed(() => {
    this._version();
    return parseRecents(read(`${RECENT_KEY}.${this._userKey()}`));
  });

  setCity(key: string): void {
    write(`${CITY_KEY}.${this._userKey()}`, key);
    this._version.update((value) => value + 1);
  }

  /** Reads the account's city the first time a screen asks, per account. */
  ensureAccountCity(force = false): void {
    const user = this._userKey();
    if (!force && this._accountCityFor === user) return;
    this._accountCityFor = user;
    this._profileService
      .getMyProfile({ silent: true })
      .pipe(take(1))
      .subscribe({
        next: (profile) => {
          this._accountCity.set(profile.account?.city?.trim() || null);
          this._accountCityLoaded.set(true);
        },
        error: () => {
          // Asked again on the next visit.
          this._accountCityFor = null;
          this._accountCityLoaded.set(true);
        },
      });
  }

  pushRecent(entry: DiscoverRecent): void {
    write(`${RECENT_KEY}.${this._userKey()}`, pushRecent(this.recents(), entry));
    this._version.update((value) => value + 1);
  }

  clearRecents(): void {
    write(`${RECENT_KEY}.${this._userKey()}`, null);
    this._version.update((value) => value + 1);
  }
}
