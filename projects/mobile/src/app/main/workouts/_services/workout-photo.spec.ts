import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkoutLogService } from 'core';

import { WorkoutPhotoStore } from './workout-photo';

describe('WorkoutPhotoStore — each photo fetched once', () => {
  let made = 0;
  const revoked: string[] = [];

  function setup() {
    const getPhoto = vi.fn(() => of(new Blob(['jpeg'], { type: 'image/jpeg' })));
    const uploadPhoto = vi.fn(() => of({ hasPhoto: true as const, photoVersion: 9 }));
    const deletePhoto = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [{ provide: WorkoutLogService, useValue: { getPhoto, uploadPhoto, deletePhoto } }],
    });
    return { store: TestBed.inject(WorkoutPhotoStore), getPhoto, uploadPhoto, deletePhoto };
  }

  beforeEach(() => {
    made = 0;
    revoked.length = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${++made}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => void revoked.push(url));
  });

  afterEach(() => vi.restoreAllMocks());

  it('reuses the same version instead of downloading it again', async () => {
    const { store, getPhoto } = setup();

    const first = await firstValueFrom(store.url('wl-1', 3));
    const again = await firstValueFrom(store.url('wl-1', 3));

    expect(again).toBe(first);
    expect(getPhoto).toHaveBeenCalledTimes(1);
  });

  it('fetches a replaced photo and lets the old copy go', async () => {
    const { store, getPhoto } = setup();

    const old = await firstValueFrom(store.url('wl-1', 3));
    await firstValueFrom(store.url('wl-1', 4));

    expect(getPhoto).toHaveBeenCalledTimes(2);
    expect(revoked).toEqual([old]);
  });

  it('keeps the uploaded copy, so nothing is fetched back', async () => {
    const { store, getPhoto } = setup();

    const { url, version } = await firstValueFrom(store.upload('wl-1', new Blob(['jpeg'])));
    const shown = await firstValueFrom(store.url('wl-1', version));

    expect(shown).toBe(url);
    expect(getPhoto).not.toHaveBeenCalled();
  });
});
