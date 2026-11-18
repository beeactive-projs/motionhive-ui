import { Component, computed, effect, inject, model, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSpinner,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { locationOutline } from 'ionicons/icons';
import { Subject, debounceTime, map, switchMap, take, tap } from 'rxjs';

import {
  AuthStore,
  PLACE_SEARCH_MIN_LENGTH,
  PickedLocation,
  PlaceSearchService,
  ProfileService,
  StripeOnboardingStore,
} from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { SearchbarAutofocusDirective } from '../../../../_shared/directives/searchbar-autofocus.directive';
import { SearchbarLabelDirective } from '../../../../_shared/directives/searchbar-label.directive';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';

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
    HexAvatar,
    IonItem,
    IonLabel,
    IonList,
    IonSearchbar,
    IonSpinner,
    SearchbarAutofocusDirective,
    SearchbarLabelDirective,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './location-sheet.html',
  styleUrl: './location-sheet.scss',
})
export class LocationSheet {
  private readonly _placeSearchService = inject(PlaceSearchService);
  private readonly _profileService = inject(ProfileService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _accountStore = inject(AccountStore);
  private readonly _authStore = inject(AuthStore);
  private readonly _stripeOnboardingStore = inject(StripeOnboardingStore);
  private readonly _translateService = inject(TranslateService);

  private readonly _query$ = new Subject<string>();

  readonly open = model(false);
  readonly searching = signal(false);
  readonly selected = signal<PickedLocation | null>(null);
  readonly saving = signal(false);

  /** The places found for the last search; kept on screen while the next one runs. */
  readonly results = signal<PickedLocation[]>([]);
  /** The last search could not be answered (slow or down), which is not "nothing found". */
  readonly failed = signal(false);
  /** A real search finished, so an empty list means nothing was found. */
  readonly searched = signal(false);

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
    // Only a coach can hold a Stripe account, and the status endpoint is
    // coach-only: asked for a trainee, its 403 surfaced as an "Access denied"
    // dialog over the profile page. A trainee's country is never locked.
    if (this._authStore.isInstructor()) this._stripeOnboardingStore.ensureLoaded();

    // Every search is asked, the same city typed again included: answers are
    // cached by the search service, and a failed one must be tried again.
    this._query$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        tap(() => this.searching.set(true)),
        switchMap((query) =>
          this._placeSearchService
            .lookup(query, { settlements: true })
            .pipe(map((answer) => ({ query, ...answer }))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((answer) => {
        this.results.set(answer.places);
        this.failed.set(answer.failed);
        // "Nothing found" only after a search that was really asked.
        this.searched.set(answer.query.trim().length >= PLACE_SEARCH_MIN_LENGTH);
        this.searching.set(false);
      });

    // Each opening starts on an empty field, so on an empty list too.
    effect(() => {
      if (!this.open()) return;
      this.selected.set(null);
      this.results.set([]);
      this.failed.set(false);
      this.searched.set(false);
      // A search still on its way from the last opening is dropped.
      this._query$.next('');
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
      void this._feedbackService.info(this._translateService.instant('toast.detail.noChanges'));
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
          void this._feedbackService.success(
            this._translateService.instant('accountSheets.location.toast.updated'),
          );
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this._accountStore.patchAccount(previous);
          void this._feedbackService.error(
            error,
            this._translateService.instant('accountSheets.location.toast.failed'),
          );
        },
      });
  }
}
