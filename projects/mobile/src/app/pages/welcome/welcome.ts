import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
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
import { Observable, Subject, debounceTime, distinctUntilChanged, switchMap, take, tap } from 'rxjs';

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
} from 'core';

import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { ACTIVITY_ICONS, categoryIcon } from '../../_shared/config/category-icons.config';
import { parseWelcomeSteps, welcomeReturnUrl } from '../../_shared/config/onboarding.config';
import { SearchbarLabelDirective } from '../../_shared/directives/searchbar-label.directive';
import { OnboardingStateService } from '../../_shared/services/onboarding-state.service';
import {
  LEVEL_CHOICES,
  MAX_OTHER_WORD_LENGTH,
  ROLE_CHOICES,
  WELCOME_COPY,
  WELCOME_ICONS,
  canGoBack,
  coachDetailsPayload,
  remainingSteps,
  splitOtherWords,
  toggleId,
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
    HexAvatar,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSearchbar,
    IonSpinner,
    IonToggle,
    IonToolbar,
    SearchbarLabelDirective,
    TranslatePipe,
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
  readonly categoryStore = inject(CategoryStore);

  readonly Steps = OnboardingSteps;
  readonly roleChoices = ROLE_CHOICES;
  readonly levelChoices = LEVEL_CHOICES;
  readonly maxWordLength = MAX_OTHER_WORD_LENGTH;
  readonly categoryIcon = categoryIcon;

  private _returnUrl = '/tabs/home';
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
  readonly otherWords = signal('');
  readonly accepting = signal(true);
  private readonly _acceptingBefore = signal(true);
  readonly place = signal<PickedLocation | null>(null);

  // ─── Coach details: the place search ──────────────────────────────────

  private readonly _placeQuery$ = new Subject<string>();
  readonly searchingPlaces = signal(false);
  readonly places = toSignal(
    this._placeQuery$.pipe(
      debounceTime(PLACE_SEARCH_DEBOUNCE_MS),
      distinctUntilChanged(),
      tap(() => this.searchingPlaces.set(true)),
      switchMap((query) => this._placeSearchService.search(query)),
      tap(() => this.searchingPlaces.set(false)),
      takeUntilDestroyed(),
    ),
    { initialValue: [] as PickedLocation[] },
  );

  /** The city on the account, said until another is picked. */
  readonly currentCity = computed(() => this._authStore.user()?.city?.trim() || null);

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
    switch (this.step()) {
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
    this.interestIds.update((ids) => toggleId(ids, id));
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
    this.coachCategoryIds.update((ids) => toggleId(ids, id));
  }

  onOtherWords(value: string | null | undefined): void {
    this.otherWords.set(value ?? '');
  }

  onPlaceSearch(value: string | null | undefined): void {
    this.place.set(null);
    this._placeQuery$.next(value ?? '');
  }

  pickPlace(place: PickedLocation): void {
    this.place.set(place);
  }

  onAccepting(checked: boolean): void {
    this.accepting.set(checked);
  }

  // ─── Moving on ────────────────────────────────────────────────────────

  next(): void {
    const step = this.step();
    if (!step || !this.canContinue() || this.saving()) {
      return;
    }
    const save = this._save(step);
    if (!save) {
      return;
    }
    this.saving.set(true);
    save.pipe(take(1)).subscribe({
      next: (state) => {
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
    const seen = this.seen().slice(0, -1);
    this.seen.set(seen);
    this._show(seen[seen.length - 1]);
  }

  /**
   * The X. Opened by itself, everything still to ask is skipped (it waits on
   * a Home card); opened on some steps, nothing is saved.
   */
  close(): void {
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

  private _save(step: OnboardingStep): Observable<OnboardingState> | null {
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
          otherSpecializations: splitOtherWords(this.otherWords()),
        });
      case OnboardingSteps.CoachDetails:
        return this._onboardingService.setCoachDetails(
          coachDetailsPayload(this.place(), this.accepting(), this._acceptingBefore()),
        );
      default:
        return null;
    }
  }

  /** The next step, or the way out when none is left. */
  private _advance(state: OnboardingState): void {
    this._onboarding.set(state);
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
      const coach = { ...user, roles: [...user.roles, UserRoles.Instructor] };
      this._authStore.setUser(coach);
      this._tokenService.setUser(coach);
    }
    this._appModeStore.setMode(NavModes.Coach);
  }

  private _show(step: OnboardingStep): void {
    this.step.set(step);
    if (step === OnboardingSteps.CoachDetails) {
      this._loadCoachProfile();
    }
  }

  /** Whether they take clients now, so Continue never flips it by accident. */
  private _loadCoachProfile(): void {
    this._profileService
      .getMyProfile({ silent: true })
      .pipe(take(1))
      .subscribe({
        next: (profile) => {
          const accepting = profile.instructorProfile?.isAcceptingClients;
          if (typeof accepting === 'boolean') {
            this.accepting.set(accepting);
            this._acceptingBefore.set(accepting);
          }
        },
        error: () => undefined,
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

  private _leave(): void {
    void this._navController.navigateRoot(this._returnUrl, { animationDirection: 'forward' });
  }
}
