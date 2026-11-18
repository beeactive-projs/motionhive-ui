import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AuthStore,
  PickedLocation,
  PlaceSearchResult,
  PlaceSearchService,
  ProfileService,
  StripeOnboardingStore,
} from 'core';

import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';
import { LocationSheet } from './location-sheet';

const cluj: PickedLocation = {
  displayName: 'Cluj-Napoca, Cluj County',
  line1: null,
  city: 'Cluj-Napoca',
  region: 'Cluj County',
  postalCode: null,
  country: 'Romania',
  countryCode: 'RO',
  latitude: null,
  longitude: null,
};

function setup() {
  // One answer per search, given by the test when it chooses.
  const answers: Subject<PlaceSearchResult>[] = [];
  const lookup = vi.fn(() => {
    const answer = new Subject<PlaceSearchResult>();
    answers.push(answer);
    return answer;
  });
  TestBed.configureTestingModule({
    providers: [
      { provide: PlaceSearchService, useValue: { lookup } },
      { provide: ProfileService, useValue: {} },
      { provide: FeedbackService, useValue: {} },
      { provide: AccountStore, useValue: { account: signal(null) } },
      { provide: AuthStore, useValue: { isInstructor: () => false } },
      { provide: StripeOnboardingStore, useValue: { hasAccount: signal(false) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const sheet = TestBed.runInInjectionContext(() => new LocationSheet());
  const type = (query: string) => {
    sheet.onSearch(query);
    vi.advanceTimersByTime(400);
  };
  const answer = (index: number, result: PlaceSearchResult) => {
    answers[index].next(result);
    answers[index].complete();
  };
  return { sheet, lookup, type, answer };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('LocationSheet', () => {
  it('searches cities only, and keeps what it found on screen while the next search runs', () => {
    const { sheet, lookup, type, answer } = setup();
    type('Cluj');
    expect(lookup).toHaveBeenCalledWith('Cluj', { settlements: true });
    answer(0, { places: [cluj], failed: false });
    expect(sheet.results()).toEqual([cluj]);

    type('Cluj-N');
    expect(sheet.searching()).toBe(true);
    expect(sheet.results()).toEqual([cluj]);
  });

  it('says a failed search failed, not that nothing was found', () => {
    const { sheet, type, answer } = setup();
    type('Iasi');
    answer(0, { places: [], failed: true });
    expect(sheet.failed()).toBe(true);
    expect(sheet.searching()).toBe(false);
  });

  it('says nothing was found only after a real search', () => {
    const { sheet, type, answer } = setup();
    type('Zzz');
    answer(0, { places: [], failed: false });
    expect(sheet.searched()).toBe(true);
    expect(sheet.failed()).toBe(false);
  });

  it('asks again for the same city after a failure', () => {
    const { lookup, type, answer } = setup();
    type('Iasi');
    answer(0, { places: [], failed: true });
    type('Iasi');
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('says nothing about a letter too short to search', () => {
    const { sheet, type, answer } = setup();
    type('B');
    answer(0, { places: [], failed: false });
    expect(sheet.searched()).toBe(false);
  });

  it('opens on an empty list, whatever the last opening found', () => {
    const { sheet, type, answer } = setup();
    type('Cluj');
    answer(0, { places: [cluj], failed: false });
    sheet.open.set(true);
    TestBed.tick();
    expect(sheet.results()).toEqual([]);
    expect(sheet.searched()).toBe(false);
  });
});
