import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
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

import { appLocale, AuthStore, formatRelativeShort, localDayKey, sentenceCase } from 'core';

import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { CLIENT_INVITE_PATH, CoachStacks } from '../../clients/client-paths';
import { CreateChoice, CreateChoices } from '../../programs/programs.config';
import { CreateSheet } from '../../programs/_sheets/create-sheet/create-sheet';
import { workoutDuration } from '../../workouts/workouts.config';
import { Hive } from '../_components/hive/hive';
import { LatestRowItem } from '../_components/latest-row/latest-row';
import { NeedRowItem } from '../_components/need-row/need-row';
import {
  coachHiveCells,
  coachLatest,
  greetingPeriod,
  LatestRow,
  latestPreview,
  latestRow,
  movedCount,
  needPreview,
  needRow,
  NeedRow,
  RING_ONE_SIZE,
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
 * The coach's Home, calm: the hive card, Needs you and Latest, nothing
 * else below the greeting (a small Today row joins them only on a day with
 * sessions). The full lists are pages in Home's own stack:
 * `/tabs/home/needs-you` and `/tabs/home/latest`.
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
    TranslatePipe,
  ],
  templateUrl: './coach-home.html',
  styleUrl: './coach-home.scss',
  providers: [CoachHomeStore],
})
export class CoachHome implements OnInit {
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);
  private readonly _authStore = inject(AuthStore);

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
    if (this.store.hasSpecialties() === false) {
      steps.push({
        key: 'specialties',
        title: this._translateService.instant('home.coach.firstWeek.specialties.title'),
        detail: this._translateService.instant('home.coach.firstWeek.specialties.detail'),
        icon: 'create-outline',
      });
    }
    return steps;
  });

  ngOnInit(): void {
    this.store.load();
  }

  /**
   * Home calls this each time it is shown again (Ionic's lifecycle reaches
   * the routed page only, not this child): a tab page stays alive, so the
   * hive would go stale.
   */
  reenter(): void {
    this.today.set(new Date());
    this.store.load();
  }

  refresh(done: () => void): void {
    this.today.set(new Date());
    this.store.load(done);
  }

  retry(): void {
    this.store.load();
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

  openStep(step: FirstStep): void {
    if (step.key === 'program') this.createOpen.set(true);
    else void this._router.navigateByUrl('/tabs/more/account/coaching');
  }

  openClients(): void {
    void this._router.navigateByUrl(CoachStacks.Clients);
  }

  invite(): void {
    void this._router.navigateByUrl(CLIENT_INVITE_PATH);
  }

  /** Same choices as the Programs tab's "+", so a program starts the same way. */
  onCreate(choice: CreateChoice): void {
    if (choice === CreateChoices.Starters) {
      void this._router.navigateByUrl('/tabs/workouts/starters');
      return;
    }
    void this._router.navigate(['/tabs/programs', choice, 'new']);
  }

  /**
   * One session opens itself, in Home's stack so back returns here; several
   * open the day in the Sessions tab.
   */
  openToday(): void {
    const first = this.todayFirst();
    if (first && this.todayMore() === 0) {
      void this._router.navigate([CoachStacks.Home, 'session', first.id]);
      return;
    }
    void this._router.navigateByUrl('/tabs/coach/sessions');
  }
}
