import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonSpinner,
  IonToggle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  Observable,
  Subject,
  debounceTime,
  distinctUntilChanged,
  map,
  switchMap,
  take,
  tap,
} from 'rxjs';

import {
  AppModeStore,
  AuthStore,
  CategoryStore,
  NavModes,
  OnboardingRoles,
  OnboardingService,
  OnboardingSteps,
  PlaceSearchService,
  ProfileService,
  TokenService,
  UserRoles,
} from 'core';
import type {
  Category,
  FitnessLevel,
  OnboardingRole,
  OnboardingState,
  OnboardingStep,
  PickedLocation,
  SetCoachDetailsPayload,
  User,
} from 'core';

import { ChipInput } from '../../_shared/components/chip-input/chip-input';
import { VenueList } from '../../_shared/components/venue-list/venue-list';
import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { ACTIVITY_ICONS, categoryIcon } from '../../_shared/config/category-icons.config';
import { DETAIL_TILES } from '../../_shared/config/detail-tiles.config';
import {
  WELCOME_FALLBACK_URL,
  parseWelcomeSteps,
  welcomeReturnUrl,
} from '../../_shared/config/onboarding.config';
import { KeyboardFooterDirective } from '../../_shared/directives/keyboard-footer.directive';
import { SearchbarAutofocusDirective } from '../../_shared/directives/searchbar-autofocus.directive';
import { SearchbarLabelDirective } from '../../_shared/directives/searchbar-label.directive';
import { OnboardingStateService } from '../../_shared/services/onboarding-state.service';
import { toggleValue } from '../../_shared/utils/list.utils';
import { AccountStore } from '../../main/account/account.store';
import {
  LEVEL_CHOICES,
  MAX_OTHER_WORDS,
  MAX_OTHER_WORD_LENGTH,
  ROLE_CHOICES,
  WELCOME_COPY,
  WELCOME_ICONS,
  canGoBack,
  categoriesNamed,
  categoryNames,
  coachDetailsPayload,
  needsCategories,
  remainingSteps,
  welcomeProgress,
} from './welcome.config';

const PLACE_SEARCH_DEBOUNCE_MS = 400;

/**
 * The welcome flow: a few questions after the first sign in, one per screen,
 * each saved as it is answered. The sign-up page is left alone by design; this
 * runs once the person is in.
 *
 * Opened by `welcomeGuard` it asks what the API says is pending, and every
 * answer, skip or close is saved, so it is never asked again. Opened from a
 * Home card or an Account row (`?steps=`) it asks just those, prefilled, as
 * an editor. Either way it ends on `returnUrl`: an invite or a notification
 * the person was on their way to is where they land.
 */
@Component({
  selector: 'mh-welcome',
  imports: [
    ChipInput,
    EmptyState,
    HexAvatar,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSearchbar,
    IonSpinner,
    IonToggle,
    IonToolbar,
    KeyboardFooterDirective,
    NgTemplateOutlet,
    SearchbarAutofocusDirective,
    SearchbarLabelDirective,
    TranslatePipe,
    VenueList,
  ],
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
  host: { class: 'mh-whole-words' },
})
export class Welcome implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _navController = inject(NavController);
  private readonly _onboardingService = inject(OnboardingService);
  private readonly _onboarding = inject(OnboardingStateService);
  private readonly _authStore = inject(AuthStore);
  private readonly _tokenService = inject(TokenService);
  private readonly _appModeStore = inject(AppModeStore);
  private readonly _profileService = inject(ProfileService);
  private readonly _placeSearchService = inject(PlaceSearchService);
  private readonly _accountStore = inject(AccountStore);
  readonly categoryStore = inject(CategoryStore);

  readonly Steps = OnboardingSteps;
  readonly roleChoices = ROLE_CHOICES;
  readonly levelChoices = LEVEL_CHOICES;
  readonly maxWords = MAX_OTHER_WORDS;
  readonly maxWordLength = MAX_OTHER_WORD_LENGTH;
  readonly locationTile = DETAIL_TILES.location;
  readonly categoryIcon = categoryIcon;

  private readonly _keyboard = viewChild(KeyboardFooterDirective);
  private readonly _otherWordsField = viewChild(ChipInput);

  private _returnUrl: string = WELCOME_FALLBACK_URL;
  /**
   * The page is on its way out (or gone): an answer that comes back now lands
   * in the stores, and never moves a screen that is not there.
   */
  private _gone = false;
  /** The steps a link asked for; null when the flow opened by itself. */
  private readonly _picked = signal<OnboardingStep[] | null>(null);

  readonly ready = signal(false);
  readonly saving = signal(false);
  readonly step = signal<OnboardingStep | null>(null);
  /** Every step shown so far, this one last: Back and "Step 2 of 3" read it. */
  readonly seen = signal<OnboardingStep[]>([]);
  private readonly _state = signal<OnboardingState | null>(null);

  // ─── Answers, prefilled from the state ────────────────────────────────

  readonly role = signal<OnboardingRole | null>(null);
  /** Activities and goals together, as the API keeps them; each screen saves its own kind. */
  readonly interestIds = signal<string[]>([]);
  readonly level = signal<FitnessLevel | null>(null);
  readonly coachCategoryIds = signal<string[]>([]);
  /** The coach's own words, as chips; kept here so they outlive the step (Back, then on again). */
  readonly otherWords = signal<string[]>([]);
  readonly accepting = signal(true);
  private readonly _acceptingBefore = signal(true);
  /** The switch was flipped here: the saved value, when it comes, no longer overwrites it. */
  private _acceptingTouched = false;
  private _coachProfileAsked = false;
  readonly place = signal<PickedLocation | null>(null);

  /** Names the coach's own words may not repeat: the list above already has them. */
  readonly otherExclusions = computed(() => categoryNames(this.categoryStore.activities()));

  // ─── Coach details: the city ──────────────────────────────────────────

  /**
   * The city is a row with its value; the search opens only when they choose
   * to change it, so nobody lands on a field asking them to type.
   */
  readonly changingCity = signal(false);
  /** What is typed in the city search now. */
  readonly placeQuery = signal('');
  private readonly _placeQuery$ = new Subject<string>();
  readonly searchingPlaces = signal(false);
  private readonly _placeAnswer = toSignal(
    this._placeQuery$.pipe(
      debounceTime(PLACE_SEARCH_DEBOUNCE_MS),
      distinctUntilChanged(),
      tap(() => this.searchingPlaces.set(true)),
      switchMap((query) =>
        this._placeSearchService.search(query).pipe(map((found) => ({ query, found }))),
      ),
      tap(() => this.searchingPlaces.set(false)),
      takeUntilDestroyed(),
    ),
    { initialValue: { query: '', found: [] as PickedLocation[] } },
  );

  /**
   * The places to pick from: only ones that name a city, since that is what
   * is saved. The last answer stays while the next keystroke's is on its way;
   * an emptied field shows none.
   */
  readonly places = computed(() => {
    if (this.placeQuery().trim() === '') {
      return [];
    }
    return this._placeAnswer().found.filter((found) => !!found.city);
  });

  /** The search answered what is typed now, and found nothing to pick. */
  readonly noPlaces = computed(() => {
    const answer = this._placeAnswer();
    if (this.searchingPlaces() || answer.query !== this.placeQuery()) {
      return false;
    }
    return answer.query.trim().length >= 2 && this.places().length === 0;
  });

  /** The city on the account, said until another is picked. */
  readonly currentCity = computed(() => {
    const user = this._authStore.user();
    if (!user || !user.city) {
      return null;
    }
    const city = user.city.trim();
    if (city === '') {
      return null;
    }
    return city;
  });

  /** The city the row shows: the one just picked, else the account's. */
  readonly cityValue = computed(() => {
    const picked = this.place();
    if (picked && picked.city) {
      return picked.city;
    }
    return this.currentCity();
  });

  // ─── What the screen shows ────────────────────────────────────────────

  readonly copy = computed(() => {
    const step = this.step();
    if (!step) {
      return null;
    }
    return WELCOME_COPY[step];
  });

  private readonly _left = computed(() => {
    const state = this._state();
    if (!state) {
      return [];
    }
    return remainingSteps(state, this._picked(), this.step());
  });

  readonly progress = computed(() => welcomeProgress(this.seen(), this._left()));

  /** One mark per step, numbered from 1. */
  readonly dots = computed(() =>
    Array.from({ length: this.progress().total }, (_, index) => index + 1),
  );

  /** Done on the last step; picking Coach always has the coach's own steps after it. */
  readonly isLast = computed(() => {
    if (this.step() === OnboardingSteps.Role && this.role() === OnboardingRoles.Coach) {
      return false;
    }
    return this._left().length === 0;
  });

  readonly canGoBack = computed(() => canGoBack(this.seen()));

  /** The flow's own steps can be passed over; a picked step is just left with the X. */
  readonly canSkip = computed(() => this._picked() === null);

  readonly canContinue = computed(() => {
    const step = this.step();
    // Saved before the category list came, these would wipe the picks.
    if (needsCategories(step) && !this.categoryStore.loaded()) {
      return false;
    }
    switch (step) {
      case OnboardingSteps.Role:
        return this.role() !== null;
      case OnboardingSteps.CoachCategories:
        return this.coachCategoryIds().length > 0;
      default:
        return true;
    }
  });

  constructor() {
    addIcons({ ...WELCOME_ICONS, ...ACTIVITY_ICONS });
    inject(DestroyRef).onDestroy(() => {
      this._gone = true;
    });
  }

  async ngOnInit(): Promise<void> {
    const params = this._route.snapshot.queryParamMap;
    this._returnUrl = welcomeReturnUrl(params.get('returnUrl'));
    const picked = parseWelcomeSteps(params.get('steps'));
    if (picked.length > 0) {
      this._picked.set(picked);
    }

    // Shown now, so the guard never sends the person back here this session,
    // whatever they do on it.
    this._onboarding.markShown();
    this.categoryStore.ensureLoaded();

    const state = await this._onboarding.ensureLoaded();
    if (this._gone) {
      return;
    }
    if (!state) {
      this._leave();
      return;
    }
    this._prefill(state);
    this._state.set(state);

    const first = remainingSteps(state, this._picked(), null)[0];
    if (!first) {
      this._leave();
      return;
    }
    this._show(first);
    this.seen.set([first]);
    this.ready.set(true);
  }

  // ─── Picking ──────────────────────────────────────────────────────────

  pickRole(role: OnboardingRole): void {
    this.role.set(role);
  }

  toggleInterest(id: string): void {
    this.interestIds.update((ids) => toggleValue(ids, id));
  }

  pickLevel(level: FitnessLevel): void {
    // Tapping the picked one clears it: the level is optional.
    this.level.update((current) => {
      if (current === level) {
        return null;
      }
      return level;
    });
  }

  toggleCoachCategory(id: string): void {
    this.coachCategoryIds.update((ids) => toggleValue(ids, id));
  }

  /** Words that only named a category on the list: that category is picked instead. */
  onOtherWordsOnList(words: string[]): void {
    const named = categoriesNamed(words, this.categoryStore.activities());
    this.coachCategoryIds.update((ids) => {
      const next = [...ids];
      for (const id of named) {
        if (!next.includes(id)) {
          next.push(id);
        }
      }
      return next;
    });
  }

  /** The tap that opens the city search, which takes the caret from it. */
  changeCity(): void {
    this.placeQuery.set('');
    this._placeQuery$.next('');
    this.changingCity.set(true);
  }

  /** The search's Cancel: the city stays as it was. */
  keepCity(): void {
    this._dismissKeyboard();
    this.changingCity.set(false);
  }

  onPlaceSearch(value: string | null | undefined): void {
    const query = value ?? '';
    this.placeQuery.set(query);
    this._placeQuery$.next(query);
  }

  pickPlace(place: PickedLocation): void {
    this._dismissKeyboard();
    this.place.set(place);
    this.changingCity.set(false);
  }

  onAccepting(checked: boolean): void {
    this._acceptingTouched = true;
    this.accepting.set(checked);
  }

  /** The category list's retry, after a failed load. */
  retryCategories(): void {
    this.categoryStore.reload();
  }

  // ─── Moving on ────────────────────────────────────────────────────────

  next(): void {
    const step = this.step();
    if (!step || !this.canContinue() || this.saving()) {
      return;
    }
    this._dismissKeyboard();
    // A word typed and not yet added goes in with the rest; one that cannot
    // (too long, no room) stays in the field with the line saying why.
    const otherWordsField = this._otherWordsField();
    if (step === OnboardingSteps.CoachCategories && otherWordsField && !otherWordsField.commit()) {
      return;
    }
    const coachDetails = this._coachDetails();
    const save = this._save(step, coachDetails);
    if (!save) {
      return;
    }
    this.saving.set(true);
    save.pipe(take(1)).subscribe({
      next: (state) => {
        if (step === OnboardingSteps.CoachDetails) {
          this._afterCoachDetails(coachDetails);
        }
        // Gone mid save: the answer lands in the state and moves no screen.
        if (this._gone) {
          this._onboarding.set(state);
          return;
        }
        if (step === OnboardingSteps.Role) {
          this._afterRole(state);
        }
        this.saving.set(false);
        this._advance(state);
      },
      // The error dialog says what went wrong; the answer stays to try again.
      error: () => this.saving.set(false),
    });
  }

  /** Passed over: off the flow and onto a Home card. Moves on even when the save fails. */
  skip(): void {
    const step = this.step();
    const state = this._state();
    if (!step || !state || this.saving()) {
      return;
    }
    this._dismissKeyboard();
    this.saving.set(true);
    this._onboardingService
      .skip([step])
      .pipe(take(1))
      .subscribe({
        next: (next) => {
          this.saving.set(false);
          this._advance(next);
        },
        error: () => {
          this.saving.set(false);
          this._advance({ ...state, flow: state.flow.filter((pending) => pending !== step) });
        },
      });
  }

  back(): void {
    if (!this.canGoBack()) {
      return;
    }
    this._dismissKeyboard();
    const seen = this.seen().slice(0, -1);
    this.seen.set(seen);
    this._show(seen[seen.length - 1]);
  }

  /**
   * The X. Opened by itself, everything still to ask is skipped (it waits on
   * a Home card); opened on some steps, nothing is saved.
   */
  close(): void {
    // Mid save the answer decides what is left; Back and Skip wait too.
    if (this.saving()) {
      return;
    }
    this._dismissKeyboard();
    const step = this.step();
    if (this._picked() === null && step) {
      const steps = [step, ...this._left()];
      this._onboardingService
        .skip(steps)
        .pipe(take(1))
        .subscribe({
          next: (state) => this._onboarding.set(state),
          error: () => undefined,
        });
    }
    this._leave();
  }

  // ─── Inside ───────────────────────────────────────────────────────────

  private _save(
    step: OnboardingStep,
    coachDetails: SetCoachDetailsPayload,
  ): Observable<OnboardingState> | null {
    switch (step) {
      case OnboardingSteps.Role: {
        const role = this.role();
        if (!role) {
          return null;
        }
        return this._onboardingService.answerRole(role);
      }
      case OnboardingSteps.Interests:
        return this._onboardingService.setInterests(
          this._picks(this.categoryStore.interestActivities()),
        );
      case OnboardingSteps.Level:
        return this._onboardingService.setLevel({
          fitnessLevel: this.level(),
          goalIds: this._picks(this.categoryStore.goals()),
        });
      case OnboardingSteps.CoachCategories:
        return this._onboardingService.setCoachCategories({
          categoryIds: this.coachCategoryIds(),
          otherSpecializations: this.otherWords(),
        });
      case OnboardingSteps.CoachDetails:
        return this._onboardingService.setCoachDetails(coachDetails);
      default:
        return null;
    }
  }

  /** The next step, or the way out when none is left. */
  private _advance(state: OnboardingState): void {
    this._onboarding.set(state);
    if (this._gone) {
      return;
    }
    const current = this.step();
    const left = remainingSteps(state, this._picked(), current);
    this._state.set(state);
    const next = left[0];
    if (!next) {
      this._leave();
      return;
    }
    this._show(next);
    this.seen.update((seen) => [...seen, next]);
  }

  /**
   * A new coach: the app shows them as one at once (as web's Become a coach
   * does) and opens in Coach mode. Their own steps come next, so the flow
   * follows the state from here, even when it was opened on the role alone.
   */
  private _afterRole(state: OnboardingState): void {
    this._picked.set(null);
    if (state.role !== OnboardingRoles.Coach) {
      return;
    }
    const user = this._authStore.user();
    if (user && !user.roles.includes(UserRoles.Instructor)) {
      this._patchUser({ roles: [...user.roles, UserRoles.Instructor] });
    }
    this._appModeStore.setMode(NavModes.Coach);
    // The coach profile the answer created: Account's coach rows read it,
    // and a flow opened from Account goes back there.
    this._accountStore.refresh();
  }

  /** What the coach details screen saves, read once so the save and its echo agree. */
  private _coachDetails(): SetCoachDetailsPayload {
    return coachDetailsPayload(this.place(), this.accepting(), this._acceptingBefore());
  }

  /**
   * The saved city on the signed-in user and the account's copy, as the
   * account's location sheet leaves them (`AccountStore.syncAuthUser`), so
   * Home, Discover and Account say the new one without a restart.
   */
  private _afterCoachDetails(saved: SetCoachDetailsPayload): void {
    if (saved.isAcceptingClients !== undefined) {
      this._accountStore.patchInstructor({ isAcceptingClients: saved.isAcceptingClients });
    }
    if (saved.city === undefined) {
      return;
    }
    const place: Pick<User, 'city' | 'countryCode'> = { city: saved.city };
    if (saved.countryCode !== undefined) {
      place.countryCode = saved.countryCode;
    }
    this._accountStore.patchAccount(place);
    this._patchUser(place);
  }

  /** The signed-in user changed here: in the app now, and in the copy it starts from. */
  private _patchUser(patch: Partial<User>): void {
    const user = this._authStore.user();
    if (!user) {
      return;
    }
    const next = { ...user, ...patch };
    this._authStore.setUser(next);
    this._tokenService.setUser(next);
  }

  private _show(step: OnboardingStep): void {
    this.step.set(step);
    // Every visit to the city starts on its row, never on the search.
    this.changingCity.set(false);
    if (step === OnboardingSteps.CoachDetails) {
      this._loadCoachProfile();
    }
  }

  /**
   * Whether they take clients now, so Continue never flips it by accident.
   * Asked once, however often Back returns here, and a flip made before the
   * answer came stays.
   */
  private _loadCoachProfile(): void {
    if (this._coachProfileAsked) {
      return;
    }
    this._coachProfileAsked = true;
    this._profileService
      .getMyProfile({ silent: true })
      .pipe(take(1))
      .subscribe({
        next: (profile) => {
          const accepting = profile.instructorProfile?.isAcceptingClients;
          if (typeof accepting !== 'boolean') {
            return;
          }
          this._acceptingBefore.set(accepting);
          if (!this._acceptingTouched) {
            this.accepting.set(accepting);
          }
        },
        // Asked again on the next visit: nothing was learned.
        error: () => {
          this._coachProfileAsked = false;
        },
      });
  }

  /** The picked interests among `offered`, in the list's order. */
  private _picks(offered: readonly Category[]): string[] {
    const picked = this.interestIds();
    return offered.filter((category) => picked.includes(category.id)).map((category) => category.id);
  }

  private _prefill(state: OnboardingState): void {
    this.interestIds.set(state.interestIds);
    this.level.set(state.fitnessLevel);
    this.coachCategoryIds.set(state.coachCategoryIds);
    if (state.role) {
      this.role.set(state.role);
    }
  }

  /** Before a button acts, the keyboard goes: Continue, Back, Skip and Close never act under it. */
  private _dismissKeyboard(): void {
    const keyboard = this._keyboard();
    if (keyboard) {
      keyboard.dismiss();
    }
  }

  private _leave(): void {
    if (this._gone) {
      return;
    }
    this._gone = true;
    void this._navController.navigateRoot(this._returnUrl, { animationDirection: 'forward' });
  }
}
