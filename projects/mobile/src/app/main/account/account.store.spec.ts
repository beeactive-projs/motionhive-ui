import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AuthStore, Genders, ProfileService, TokenService } from 'core';
import type { AccountInfo, MyProfile, User } from 'core';

import { AccountStore } from './account.store';

function setup(account: Partial<AccountInfo>) {
  const current = signal<User | null>({ id: 'u1' } as User);
  const reply = new Subject<MyProfile>();
  const updateMyProfile = vi.fn(() => reply.asObservable());
  const getMyProfile = vi.fn(() => ({
    pipe: () => ({
      subscribe: (next: (profile: MyProfile) => void) =>
        next({ account: account as AccountInfo, roles: [], instructorProfile: null }),
    }),
  }));
  const setUser = vi.fn((next: User) => current.set(next));
  const storeUser = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: ProfileService, useValue: { getMyProfile, updateMyProfile } },
      { provide: AuthStore, useValue: { user: current, setUser } },
      { provide: TokenService, useValue: { setUser: storeUser } },
    ],
  });
  const store = TestBed.inject(AccountStore);
  store.ensureLoaded();
  return { store, reply, updateMyProfile, current, storeUser };
}

describe('AccountStore, birthday and gender', () => {
  it('reads them off the account, null while not given', () => {
    const { store } = setup({ birthDate: '1992-03-14', gender: Genders.Female });
    expect(store.birthDate()).toBe('1992-03-14');
    expect(store.gender()).toBe('FEMALE');

    TestBed.resetTestingModule();
    const bare = setup({}).store;
    expect(bare.birthDate()).toBeNull();
    expect(bare.gender()).toBeNull();
  });

  it('saves through /profile/me like the other details, shown at once', () => {
    const { store, reply, updateMyProfile, current, storeUser } = setup({});

    store.updateAboutYou({ gender: Genders.Male }).subscribe();

    expect(updateMyProfile).toHaveBeenCalledWith({ account: { gender: 'MALE' } });
    expect(store.gender()).toBe('MALE');

    // Saved: on the signed-in user too, for the welcome flow and the next start.
    reply.next({} as MyProfile);
    expect(current()?.gender).toBe('MALE');
    expect(storeUser).toHaveBeenCalledWith(expect.objectContaining({ gender: 'MALE' }));
  });

  it('puts back only what it changed when the server refuses', () => {
    const { store, reply, current } = setup({ birthDate: '1992-03-14', gender: Genders.Female });
    let failed = false;

    store.updateAboutYou({ birthDate: null }).subscribe({
      error: () => {
        failed = true;
      },
    });
    expect(store.birthDate()).toBeNull();

    reply.error(new Error('400'));
    expect(failed).toBe(true);
    expect(store.birthDate()).toBe('1992-03-14');
    expect(store.gender()).toBe('FEMALE');
    expect(current()?.birthDate).toBeUndefined();
  });
});
