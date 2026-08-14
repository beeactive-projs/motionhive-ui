import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { AppModeStore } from './app-mode.store';
import { STORAGE_KEYS } from '../constants/storage-keys.const';
import { NavModes } from '../models/common/nav.enums';

function makeStore(): AppModeStore {
  // Fresh injector per case — the stored value is read once at construction.
  TestBed.resetTestingModule();
  return TestBed.inject(AppModeStore);
}

describe('AppModeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults to coach when nothing is stored', () => {
    expect(makeStore().mode()).toBe(NavModes.Coach);
  });

  it('restores a stored train preference', () => {
    localStorage.setItem(STORAGE_KEYS.NAV_MODE, NavModes.Train);
    expect(makeStore().mode()).toBe(NavModes.Train);
  });

  it('falls back to coach when the stored value is not a known mode', () => {
    localStorage.setItem(STORAGE_KEYS.NAV_MODE, 'nonsense');
    expect(makeStore().mode()).toBe(NavModes.Coach);
  });

  it('persists under the historical mh-nav-mode key shared with web', () => {
    makeStore().setMode(NavModes.Train);
    expect(localStorage.getItem('mh-nav-mode')).toBe(NavModes.Train);
  });

  it('keeps isCoach and isTrain in step with the mode', () => {
    const store = makeStore();
    expect(store.isCoach()).toBe(true);
    expect(store.isTrain()).toBe(false);

    store.setMode(NavModes.Train);
    expect(store.isCoach()).toBe(false);
    expect(store.isTrain()).toBe(true);
  });

  it('does not write when the mode is unchanged', () => {
    const store = makeStore();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    store.setMode(NavModes.Coach);
    expect(write).not.toHaveBeenCalled();
  });

  it('toggles between the two modes', () => {
    const store = makeStore();
    store.toggle();
    expect(store.mode()).toBe(NavModes.Train);
    store.toggle();
    expect(store.mode()).toBe(NavModes.Coach);
  });

  it('clears the stored preference on reset', () => {
    const store = makeStore();
    store.setMode(NavModes.Train);
    store.reset();
    expect(store.mode()).toBe(NavModes.Coach);
    expect(localStorage.getItem(STORAGE_KEYS.NAV_MODE)).toBeNull();
  });

  it('survives storage being unavailable', () => {
    const store = makeStore();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    // The preference is best-effort; a private-mode failure must not take the
    // shell down with it.
    expect(() => store.setMode(NavModes.Train)).not.toThrow();
    expect(store.mode()).toBe(NavModes.Train);
  });
});
