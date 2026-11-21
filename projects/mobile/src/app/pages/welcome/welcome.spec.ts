import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NavController } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  AppModeStore,
  AuthStore,
  CategoryStore,
  Genders,
  OnboardingService,
  PlaceSearchService,
  ProfileService,
  TokenService,
} from 'core';
import type { OnboardingState, User } from 'core';

import { OnboardingStateService } from '../../_shared/services/onboarding-state.service';
import { AccountStore } from '../../main/account/account.store';
import { Welcome } from './welcome';

function state(flow: OnboardingState['flow']): OnboardingState {
  return {
    flowVersion: 2,
    role: 'TRAIN',
    steps: {
      ROLE: 'DONE',
      INTERESTS: 'DONE',
      LEVEL: 'DONE',
      COACH_CATEGORIES: null,
      COACH_DETAILS: null,
      ABOUT_YOU: null,
    },
    flow,
    trainCard: [],
    coachCard: [],
    interestIds: [],
    fitnessLevel: null,
    coachCategoryIds: [],
  };
}

async function setup(user: Partial<User>, onboarding: Partial<OnboardingState> = {}) {
  const current = signal<User | null>({ id: 'u1', roles: [], ...user } as User);
  const setUser = vi.fn((next: User) => current.set(next));
  const storeUser = vi.fn();
  const setAboutYou = vi.fn(() => of(state([])));
  const navigateRoot = vi.fn(() => Promise.resolve(true));
  const setState = vi.fn();
  const patchAccount = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
      },
      { provide: NavController, useValue: { navigateRoot } },
      { provide: OnboardingService, useValue: { setAboutYou, skip: vi.fn() } },
      {
        provide: OnboardingStateService,
        useValue: {
          markShown: vi.fn(),
          ensureLoaded: () => Promise.resolve({ ...state(['ABOUT_YOU']), ...onboarding }),
          set: setState,
        },
      },
      { provide: AuthStore, useValue: { user: current, setUser } },
      { provide: TokenService, useValue: { setUser: storeUser } },
      { provide: AppModeStore, useValue: {} },
      { provide: ProfileService, useValue: {} },
      { provide: PlaceSearchService, useValue: { search: () => of([]) } },
      { provide: AccountStore, useValue: { patchAccount } },
      {
        provide: CategoryStore,
        useValue: {
          ensureLoaded: vi.fn(),
          loaded: signal(true),
          failed: signal(false),
          activities: signal([]),
          interestActivities: signal([]),
          goals: signal([]),
        },
      },
    ],
  });
  TestBed.overrideComponent(Welcome, { set: { template: '', imports: [] } });
  const page = TestBed.createComponent(Welcome).componentInstance;
  await page.ngOnInit();
  return { page, setAboutYou, setUser, storeUser, navigateRoot, setState, patchAccount };
}

describe('Welcome, about you', () => {
  it('is the last step, and needs one answer before Done', async () => {
    const { page } = await setup({});

    expect(page.step()).toBe('ABOUT_YOU');
    expect(page.copy()?.title).toBe('welcome.aboutYou.title');
    expect(page.isLast()).toBe(true);
    expect(page.canSkip()).toBe(true);
    expect(page.canContinue()).toBe(false);

    page.pickGender(Genders.Female);
    expect(page.canContinue()).toBe(true);

    // The picked one again clears it, as the level does.
    page.pickGender(Genders.Female);
    expect(page.gender()).toBeNull();
    expect(page.canContinue()).toBe(false);

    page.birthDate.set('1992-03-14');
    expect(page.canContinue()).toBe(true);
  });

  it('starts on what the account has', async () => {
    const { page } = await setup({ birthDate: '1992-03-14', gender: Genders.Male });
    expect(page.birthDate()).toBe('1992-03-14');
    expect(page.gender()).toBe('MALE');
  });

  it("trusts the user over the state's copy, and reads the state when the user has none", async () => {
    const fresh = await setup({ birthDate: null, gender: Genders.Female }, { birthDate: '1990-01-02' });
    expect(fresh.page.birthDate()).toBeNull();
    expect(fresh.page.gender()).toBe('FEMALE');

    TestBed.resetTestingModule();
    const older = await setup({}, { birthDate: '1990-01-02', gender: Genders.Male });
    expect(older.page.birthDate()).toBe('1990-01-02');
    expect(older.page.gender()).toBe('MALE');
  });

  it('sends what changed, keeps it on the user and goes in', async () => {
    const { page, setAboutYou, setUser, storeUser, navigateRoot, setState, patchAccount } = await setup({
      birthDate: '1992-03-14',
    });

    page.pickGender(Genders.PreferNotToSay);
    page.next();

    expect(setAboutYou).toHaveBeenCalledWith({ gender: 'PREFER_NOT_TO_SAY' });
    expect(setUser).toHaveBeenCalledWith(
      expect.objectContaining({ birthDate: '1992-03-14', gender: 'PREFER_NOT_TO_SAY' }),
    );
    expect(storeUser).toHaveBeenCalledWith(expect.objectContaining({ gender: 'PREFER_NOT_TO_SAY' }));
    expect(patchAccount).toHaveBeenCalledWith({ gender: 'PREFER_NOT_TO_SAY' });
    expect(setState).toHaveBeenCalledWith(state([]));
    expect(navigateRoot).toHaveBeenCalledWith('/tabs/home', { animationDirection: 'forward' });
  });
});
