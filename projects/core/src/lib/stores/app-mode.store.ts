import { computed, Injectable, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys.const';
import { NavMode, NavModes } from '../models/common/nav.enums';

/**
 * Coach/Train workspace mode — shared by web's sidenav and mobile's tab bar
 * so the two can never disagree on the persisted value or the default.
 *
 * The store deliberately does NOT decide whether the mode switch should be
 * *visible*. That is a role question (only an instructor has two modes), and
 * it belongs to whichever shell renders the toggle.
 *
 * Persistence is synchronous `localStorage` on purpose: the shell reads the
 * mode during its first render to pick a nav set, so an async source would
 * flash the wrong one on every cold start.
 */
@Injectable({ providedIn: 'root' })
export class AppModeStore {
  private readonly _mode = signal<NavMode>(readStoredMode());

  readonly mode = this._mode.asReadonly();
  readonly isCoach = computed(() => this._mode() === NavModes.Coach);
  readonly isTrain = computed(() => this._mode() === NavModes.Train);

  setMode(mode: NavMode): void {
    if (this._mode() === mode) return;
    this._mode.set(mode);
    write(mode);
  }

  toggle(): void {
    this.setMode(this.isCoach() ? NavModes.Train : NavModes.Coach);
  }

  /** Logout — drop the preference so the next account starts from the default. */
  reset(): void {
    this._mode.set(DEFAULT_MODE);
    try {
      localStorage.removeItem(STORAGE_KEYS.NAV_MODE);
    } catch {
      /* private mode / storage disabled */
    }
  }
}

const DEFAULT_MODE: NavMode = NavModes.Coach;

function readStoredMode(): NavMode {
  try {
    return localStorage.getItem(STORAGE_KEYS.NAV_MODE) === NavModes.Train
      ? NavModes.Train
      : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function write(mode: NavMode): void {
  try {
    localStorage.setItem(STORAGE_KEYS.NAV_MODE, mode);
  } catch {
    /* private mode / storage disabled */
  }
}
