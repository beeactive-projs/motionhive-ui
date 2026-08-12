import { Component, computed, effect, inject, model, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { locationOutline } from 'ionicons/icons';
import { Subject, debounceTime, distinctUntilChanged, switchMap, take, tap } from 'rxjs';

import { PickedLocation, PlaceSearchService, ProfileService, StripeOnboardingStore } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';

const SEARCH_DEBOUNCE_MS = 400;

/**
 * City and country, chosen from a place search.
 *
 * The country is locked once a Stripe Connect account exists: Stripe cannot
 * change a connected account's country, so letting it drift here would silently
 * desync payments from the profile. Web enforces the same rule.
 */
@Component({
  selector: 'mh-location-sheet',
  imports: [
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSearchbar,
    IonSpinner,
    SheetShell,
  ],
  templateUrl: './location-sheet.html',
  styleUrl: './location-sheet.scss',
})
export class LocationSheet {
  private readonly _placeSearchService = inject(PlaceSearchService);
  private readonly _profileService = inject(ProfileService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _accountStore = inject(AccountStore);
  private readonly _stripeOnboardingStore = inject(StripeOnboardingStore);

  private readonly _query$ = new Subject<string>();

  readonly open = model(false);
  readonly searching = signal(false);
  readonly selected = signal<PickedLocation | null>(null);
  readonly saving = signal(false);

  readonly results = toSignal(
    this._query$.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged(),
      tap(() => this.searching.set(true)),
      switchMap((query) => this._placeSearchService.search(query)),
      tap(() => this.searching.set(false)),
      takeUntilDestroyed(),
    ),
    { initialValue: [] as PickedLocation[] },
  );

  readonly countryLocked = this._stripeOnboardingStore.hasAccount;
  readonly currentCountry = computed(() => this._accountStore.account()?.countryCode ?? null);

  readonly canSave = computed(() => {
    const picked = this.selected();
    if (!picked) return false;
    if (!this.countryLocked()) return true;
    // A locked country means only same-country places are selectable.
    return picked.countryCode === this.currentCountry();
  });

  readonly blockedByCountryLock = computed(
    () => !!this.selected() && this.countryLocked() && !this.canSave(),
  );

  constructor() {
    addIcons({ locationOutline });
    this._stripeOnboardingStore.ensureLoaded();

    effect(() => {
      if (!this.open()) return;
      this.selected.set(null);
    });
  }

  onSearch(value: string): void {
    this.selected.set(null);
    this._query$.next(value);
  }

  pick(place: PickedLocation): void {
    this.selected.set(place);
  }

  save(): void {
    const picked = this.selected();
    const account = this._accountStore.account();
    if (!picked || !account) return;

    const patch = { city: picked.city, countryCode: picked.countryCode };
    if (patch.city === account.city && patch.countryCode === account.countryCode) {
      this.open.set(false);
      void this._feedbackService.info('No changes');
      return;
    }

    const previous = { city: account.city, countryCode: account.countryCode };
    this.saving.set(true);
    this._accountStore.patchAccount(patch);

    this._profileService
      .updateMyProfile({ account: patch })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this._accountStore.syncAuthUser();
          this.open.set(false);
          void this._feedbackService.success('Location updated');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this._accountStore.patchAccount(previous);
          void this._feedbackService.error(error, 'Could not update your location.');
        },
      });
  }
}
