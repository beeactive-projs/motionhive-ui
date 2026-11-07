import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
} from '@ionic/angular/standalone';

import {
  appLocale,
  AuthStore,
  formatRelativeShort,
  localDayKey,
  OnboardingSteps,
  sentenceCase,
} from 'core';

import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { RowSkeleton } from '../../../_shared/components/row-skeleton/row-skeleton';
import { avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { CoachStacks } from '../../clients/client-paths';
import { CreateChoice, CreateChoices } from '../../programs/programs.config';
import { CreateSheet } from '../../programs/_sheets/create-sheet/create-sheet';
import { workoutDuration } from '../../workouts/workouts.config';
import { HOME_STACK, HomePages } from '../home-stack.config';
import { Hive } from '../_components/hive/hive';
import { LatestRowItem } from '../_components/latest-row/latest-row';
import { NeedRowItem } from '../_components/need-row/need-row';
import { welcomeLink } from '../../../_shared/config/onboarding.config';
import { OnboardingStateService } from '../../../_shared/services/onboarding-state.service';
import { WelcomeCard } from '../_components/welcome-card/welcome-card';
import {
  buildingCells,
  coachHiveCells,
  coachLatest,
  coachShortcuts,
  greetingPeriod,
  isBuilding,
  LatestRow,
  latestPreview,
  latestRow,
  LoadStates,
  loadState,
  movedCount,
  needPreview,
  needRow,
  NeedRow,
  RING_ONE_SIZE,
  Shortcut,
  ShortcutIds,
  SLOW_LOAD_MS,
} from '../home.config';
import { injectActOnNeed } from '../needs-you/need-actions';
import { CoachHomeStore } from './coach-home.store';

/** A first step for a coach with no clients yet. */
interface FirstStep {
  key: 'program' | 'specialties';
  title: string;
  detail: string;
  icon: string;
}

/**
 * The coach's Home, calm: the hive card, Needs you and Latest below the
 * greeting (a small Today row joins them only on a day with sessions), and
 * three small shortcuts at the bottom. The full lists are pages in Home's
 * own stack: `/tabs/home/needs-you` and `/tabs/home/latest`; the hive card
 * opens the whole hive, `/tabs/home/hive`.
 *
 * Before anything has arrived the card builds its comb and the lists show
 * placeholder rows under their heads (`loadState`); a reload keeps what is
 * on screen.
 */
@Component({
  selector: 'mh-coach-home',
  imports: [
    CreateSheet,
    DatePipe,
    HexAvatar,
    Hive,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    LatestRowItem,
    NeedRowItem,
    RowSkeleton,
    TranslatePipe,
    WelcomeCard,
  ],
  templateUrl: './coach-home.html',
  styleUrl: './coach-home.scss',
  providers: [CoachHomeStore],
})
export class CoachHome implements OnInit {
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);
  private readonly _authStore = inject(AuthStore);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _onboarding = inject(OnboardingStateService);

  readonly store = inject(CoachHomeStore);
  readonly act = injectActOnNeed();

  /** Re-read on every entry: a tab page kept alive overnight would date itself. */
  readonly today = signal(new Date());

  readonly createOpen = signal(false);

  private readonly _coachName = computed(() => {
    const user = this._authStore.user();
    return [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  });

  /** "Saturday 31 Oct", "Sâmbătă, 31 oct.": the reader's own date order. */
  readonly dateLine = computed(() => {
    const locale = appLocale();
    const date = this.today().toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
    return sentenceCase(date, locale);
  });

  readonly greeting = computed(() => {
    const name = this._authStore.user()?.firstName?.trim();
    const period = greetingPeriod(this.today());
    return name
      ? this._translateService.instant(`home.greeting.${period}`, { name })
      : this._translateService.instant(`home.greetingNoName.${period}`);
  });

  // ─── The hive ────────────────────────────────────────────────

  readonly LoadStates = LoadStates;

  /** Set once a first load has run `SLOW_LOAD_MS`; reset by each new one. */
  private readonly _slow = signal(false);
  private _slowTimer: ReturnType<typeof setTimeout> | undefined;

  readonly hiveState = computed(() =>
    loadState({
      shown: this.store.roster() !== null,
      loading: this.store.rosterLoading(),
      failed: this.store.rosterFailed(),
      slow: this._slow(),
    }),
  );

  readonly building = computed(() => isBuilding(this.hiveState()));

  /** The first load's comb, the same every time. */
  readonly buildCells = buildingCells();

  readonly cells = computed(() => coachHiveCells(this._coachName(), this.store.clients()));

  /** Past one ring of clients the card shrinks its cells, so two rings fit. */
  readonly twoRings = computed(() => this.store.clients().length > RING_ONE_SIZE);

  readonly moved = computed(() => movedCount(this.store.clients()));

  readonly hiveTitle = computed(() =>
    this._translateService.instant('home.coach.hive.title', {
      moved: this.moved(),
      total: this.store.clients().length,
    }),
  );

  readonly hiveLabel = computed(() =>
    this.store.isFirstWeek()
      ? this._translateService.instant('home.coach.firstWeek.title')
      : this._translateService.instant('home.coach.hive.a11y', {
          moved: this.moved(),
          total: this.store.clients().length,
        }),
  );

  // ─── Today ───────────────────────────────────────────────────

  /** The day's first session, and how many more follow it. */
  readonly todayFirst = computed(() => this.store.agenda()[0] ?? null);
  readonly todayMore = computed(() => Math.max(0, this.store.agenda().length - 1));

  // ─── Needs you ───────────────────────────────────────────────

  /** Three rows at most, one per person (`needPreview`). */
  readonly needs = computed<NeedRow[]>(() => {
    const copy = {
      t: (key: string, params?: Record<string, unknown>) =>
        this._translateService.instant(key, params),
      locale: appLocale(),
      todayKey: localDayKey(this.today()),
    };
    return needPreview(this.store.needs()).map((item) => needRow(item, copy));
  });

  /** What the page holds beyond Home's rows. */
  readonly moreNeeds = computed(() => this.store.needs().length - this.needs().length);

  // ─── Latest ──────────────────────────────────────────────────

  readonly latest = computed<LatestRow[]>(() => {
    const now = this.today();
    const copy = {
      t: (key: string, params?: Record<string, unknown>) =>
        this._translateService.instant(key, params),
      locale: appLocale(),
      time: formatRelativeShort,
      duration: workoutDuration,
      tone: avatarToneFor,
    };
    return latestPreview(coachLatest(this.store.activity(), now), now).map((entry) =>
      latestRow(entry, copy),
    );
  });

  // ─── Shortcuts ───────────────────────────────────────────────

  /**
   * Once the card knows what it shows, so a first week never flashes the
   * tiles its card and steps already offer (`coachShortcuts`).
   */
  readonly shortcuts = computed<Shortcut[]>(() => {
    if (this.building()) return [];
    const firstWeek = this.store.isFirstWeek();
    return coachShortcuts({
      invite: firstWeek,
      program: firstWeek && this.firstSteps().some((step) => step.key === 'program'),
    });
  });

  // ─── First week ──────────────────────────────────────────────

  readonly firstSteps = computed<FirstStep[]>(() => {
    const steps: FirstStep[] = [];
    if (this.store.hasPrograms() === false) {
      steps.push({
        key: 'program',
        title: this._translateService.instant('home.coach.firstWeek.program.title'),
        detail: this._translateService.instant('home.coach.firstWeek.program.detail'),
        icon: 'add-outline',
      });
    }
    // What Discover matches a coach on is their categories now; their own
    // words count too. The welcome card asks the same while it shows.
    const coachCategories = this._onboarding.state()?.coachCategoryIds.length ?? 0;
    const cardAsks = this._onboarding.coachCard().length > 0;
    if (this.store.hasSpecialties() === false && coachCategories === 0 && !cardAsks) {
      steps.push({
        key: 'specialties',
        title: this._translateService.instant('home.coach.firstWeek.specialties.title'),
        detail: this._translateService.instant('home.coach.firstWeek.specialties.detail'),
        icon: 'create-outline',
      });
    }
    return steps;
  });

  constructor() {
    this._destroyRef.onDestroy(() => clearTimeout(this._slowTimer));
  }

  ngOnInit(): void {
    this._watchSlow();
    this.store.load();
  }

  /**
   * Home calls this each time it is shown again (Ionic's lifecycle reaches
   * the routed page only, not this child): a tab page stays alive, so the
   * hive would go stale.
   */
  reenter(): void {
    this.today.set(new Date());
    this._retrying();
    this.store.load();
  }

  refresh(done: () => void): void {
    this.today.set(new Date());
    this._retrying();
    this.store.load(done);
  }

  retry(): void {
    this._watchSlow();
    this.store.load();
  }

  /** A load after a failed first one is a first load again, slow timer and all. */
  private _retrying(): void {
    if (this.hiveState() === LoadStates.Failed) this._watchSlow();
  }

  private _watchSlow(): void {
    clearTimeout(this._slowTimer);
    this._slow.set(false);
    this._slowTimer = setTimeout(() => this._slow.set(true), SLOW_LOAD_MS);
  }

  openNeeds(): void {
    void this._router.navigateByUrl('/tabs/home/needs-you');
  }

  openLatest(): void {
    void this._router.navigateByUrl('/tabs/home/latest');
  }

  openRow(row: LatestRow): void {
    void this._router.navigate(row.link, row.state ? { state: row.state } : {});
  }

  /** What they coach: the welcome flow's category step, back here after. */
  openStep(step: FirstStep): void {
    if (step.key === 'program') {
      this.createOpen.set(true);
      return;
    }
    const link = welcomeLink([OnboardingSteps.CoachCategories], '/tabs/home');
    void this._router.navigate([link.path], { queryParams: link.queryParams });
  }

  /** The whole hive, every client a cell, in Home's stack (C1). */
  openHive(): void {
    void this._router.navigateByUrl(HomePages.Hive);
  }

  openShortcut(shortcut: Shortcut): void {
    switch (shortcut.id) {
      case ShortcutIds.Program:
        this.createOpen.set(true);
        return;
      case ShortcutIds.Invite:
        this.invite();
        return;
      case ShortcutIds.Exercise:
        void this._router.navigateByUrl(HomePages.NewExercise);
        return;
    }
  }

  /** The invite page in Home's stack, so back (and Done) return here. */
  invite(): void {
    void this._router.navigateByUrl(HomePages.Invite);
  }

  /**
   * Same choices as the Programs tab's "+", and every one stays on the
   * coach's side: a new program or routine opens in Programs, and the
   * starters are in the library there (a coach with nothing of their own
   * sees them all), never the trainee's Workouts pages.
   */
  onCreate(choice: CreateChoice): void {
    if (choice === CreateChoices.Starters) {
      void this._router.navigateByUrl(CoachStacks.Programs);
      return;
    }
    void this._router.navigate([CoachStacks.Programs, choice, 'new']);
  }

  /**
   * One session opens itself, several open the day's agenda; both in Home's
   * stack, so back returns here.
   */
  openToday(): void {
    const first = this.todayFirst();
    if (first && this.todayMore() === 0) {
      void this._router.navigate([HOME_STACK, 'session', first.id]);
      return;
    }
    void this._router.navigateByUrl(HomePages.Agenda);
  }
}
