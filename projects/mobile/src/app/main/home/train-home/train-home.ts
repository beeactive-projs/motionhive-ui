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

import {
  appLocale,
  AuthStore,
  dayFromKey,
  formatRelativeShort,
  GroupWithMyRole,
  MyInstructor,
  sentenceCase,
  weekdayNames,
} from 'core';

import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor, GROUP_AVATAR_TONE } from '../../../_shared/utils/avatar-tone.utils';
import { groupBase, personBase, ProfileStacks } from '../../../_shared/utils/stack-paths';
import { GroupsSegments } from '../../groups/groups.filters';
import { workoutDuration, workoutMetaLine } from '../../workouts/workouts.config';
import { Hive } from '../_components/hive/hive';
import { LatestRowItem } from '../_components/latest-row/latest-row';
import {
  greetingPeriod,
  LatestRow,
  latestPreview,
  latestRow,
  weekCells,
  weekLine,
  WeekLineKinds,
} from '../home.config';
import { TrainHomeStore } from './train-home.store';

/** Someone in "Your hive": a coach or a group, as one button. */
interface HiveMember {
  key: string;
  /** The full name: the avatar's initials and, with the caption, the button's accessible name. */
  name: string;
  /** What shows under the avatar: a person's first name, a group's name. */
  shortName: string;
  caption: string;
  imageUrl: string | null;
  color: string;
  open: () => void;
}

/**
 * The trainee's Home, calm: the week card with the day's workout in it,
 * Your hive, and Latest, nothing else below the greeting (a small Today row
 * joins them only on a day with a booking). Latest's full list is a page in
 * Home's own stack, `/tabs/home/latest`.
 */
@Component({
  selector: 'mh-train-home',
  imports: [
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
    TranslatePipe,
  ],
  templateUrl: './train-home.html',
  styleUrl: './train-home.scss',
  providers: [TrainHomeStore],
})
export class TrainHome implements OnInit {
  private readonly _authStore = inject(AuthStore);
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);

  readonly store = inject(TrainHomeStore);

  /** Re-read on every entry: a tab page kept alive overnight would date itself. */
  readonly today = signal(new Date());

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

  // ─── The week ────────────────────────────────────────────────

  readonly cells = computed(() => weekCells(this.store.days(), weekdayNames('narrow')));

  /** What the picture shows, said in a sentence for a screen reader. */
  readonly weekLabel = computed(() => {
    const summary = this.store.summary();
    return summary.planned
      ? this._translateService.instant('home.train.week.a11yPlan', {
          done: summary.planDone,
          planned: summary.planned,
        })
      : this._translateService.instant('home.train.week.a11yDays', { count: summary.trainedDays });
  });

  /** The one headline: the plan's count, the days trained, or what a cell is for. */
  readonly weekTitle = computed(() => {
    const summary = this.store.summary();
    if (summary.planned) {
      return this._translateService.instant('home.train.week.headlinePlan', {
        done: summary.planDone,
        planned: summary.planned,
      });
    }
    if (summary.trainedDays) {
      return this._translateService.instant('home.train.week.headlineDays', {
        count: summary.trainedDays,
      });
    }
    return this._translateService.instant('home.train.week.emptyTitle');
  });

  /** The most useful line under the headline, if any (`weekLine`). */
  private readonly _weekLine = computed(() =>
    weekLine(this.store.summary(), this.store.streakWeeks()),
  );

  /**
   * A status ("20 weeks in a row", a record, today's count) keeps to one
   * line; the empty week's invitation is a sentence, and wraps.
   */
  readonly weekSubIsStatus = computed(() => {
    const kind = this._weekLine()?.kind;
    return !!kind && kind !== WeekLineKinds.Empty;
  });

  /** One line under it, the most useful one. */
  readonly weekSub = computed(() => {
    const line = this._weekLine();
    if (!line) return null;
    const t = (key: string, params?: Record<string, unknown>) =>
      this._translateService.instant(`home.train.week.${key}`, params);
    switch (line.kind) {
      case WeekLineKinds.TodayMakes:
        return t('todayMakes', { count: line.count });
      case WeekLineKinds.PlanDone:
        return t('planDone');
      case WeekLineKinds.Empty:
        return t('emptySub');
      case WeekLineKinds.Record:
        return t('record', {
          weekday: dayFromKey(line.day).toLocaleDateString(appLocale(), { weekday: 'long' }),
        });
      case WeekLineKinds.Streak:
        return t('streak', { count: line.weeks });
    }
  });

  /** "Today", or "Up next · Tuesday" for a later day of the plan; the full
   * weekday, since Romanian's short "mar." also stands for March. */
  readonly nextKicker = computed(() => {
    const next = this.store.nextWorkout();
    if (!next) return '';
    if (next.isToday) return this._translateService.instant('time.today');
    const date = next.workout.scheduledDate;
    const weekday = date ? dayFromKey(date).toLocaleDateString(appLocale(), { weekday: 'long' }) : '';
    return this._translateService.instant('home.train.today.upNext', { weekday });
  });

  /** "From Alex · 3 exercises · ~45 min", whatever of it is known. */
  readonly nextMeta = computed(() => {
    const workout = this.store.nextWorkout()?.workout;
    if (!workout) return '';
    const parts: string[] = [];
    const coach = workout.instructor?.firstName?.trim();
    if (coach) parts.push(this._translateService.instant('home.train.today.from', { name: coach }));
    const meta = workoutMetaLine(workout.exercises?.length ?? null, workout.estimatedDurationMinutes);
    if (meta) parts.push(meta);
    return parts.join(' · ');
  });

  // ─── Today ───────────────────────────────────────────────────

  /** The day's first booking, and how many more follow it. */
  readonly todayFirst = computed(() => this.store.todayBookings()[0] ?? null);
  readonly todayMore = computed(() => Math.max(0, this.store.todayBookings().length - 1));

  // ─── Your hive ───────────────────────────────────────────────

  readonly members = computed<HiveMember[]>(() => [
    ...this.store.coaches().map((coach) => this._coachMember(coach)),
    ...this.store.groups().map((group) => this._groupMember(group)),
  ]);

  readonly showBuildHive = computed(() => this.store.peopleLoaded() && this.members().length === 0);

  // ─── Latest ──────────────────────────────────────────────────

  readonly latest = computed<LatestRow[]>(() => {
    const copy = {
      t: (key: string, params?: Record<string, unknown>) =>
        this._translateService.instant(key, params),
      locale: appLocale(),
      time: formatRelativeShort,
      duration: workoutDuration,
      tone: avatarToneFor,
    };
    return latestPreview(this.store.latest(), this.today()).map((entry) => latestRow(entry, copy));
  });

  ngOnInit(): void {
    this.store.load();
  }

  /**
   * Home calls this each time it is shown again (Ionic's lifecycle reaches
   * the routed page only, not this child): a tab page stays alive, so the
   * week would go stale.
   */
  reenter(): void {
    this.today.set(new Date());
    this.store.load();
  }

  refresh(done: () => void): void {
    this.today.set(new Date());
    this.store.load(done);
  }

  // ─── Workouts ────────────────────────────────────────────────

  resume(): void {
    const log = this.store.inProgress();
    if (log) void this._router.navigate(['/tabs/workouts/log', log.id]);
  }

  /** The day's preview, where it is started, as on the Workouts tab. */
  openNext(): void {
    const workout = this.store.nextWorkout()?.workout;
    if (!workout) return;
    void this._router.navigate(['/tabs/workouts/preview', workout.programAssignmentId], {
      queryParams: { workout: workout.assignedWorkoutId },
    });
  }

  startEmpty(): void {
    void this._router.navigate(['/tabs/workouts/log', 'new']);
  }

  // ─── People and posts ────────────────────────────────────────

  findCoach(): void {
    void this._router.navigateByUrl('/tabs/discover/coaches');
  }

  findGroup(): void {
    void this._router.navigate(['/tabs/groups'], {
      queryParams: { segment: GroupsSegments.Discover },
    });
  }

  addToHive(): void {
    void this._router.navigateByUrl('/tabs/discover');
  }

  openLatest(): void {
    void this._router.navigateByUrl('/tabs/home/latest');
  }

  /** A post or a record, in Home's own stack so back returns here. */
  openRow(row: LatestRow): void {
    void this._router.navigate(row.link, row.state ? { state: row.state } : {});
  }

  /**
   * One booking opens itself, in Home's stack so back returns here; several
   * open the list in the Sessions tab.
   */
  openToday(): void {
    const first = this.todayFirst();
    if (first && this.todayMore() === 0) {
      void this._router.navigate([ProfileStacks.Home, 'booking', first.instanceId], {
        state: { participant: first },
      });
      return;
    }
    void this._router.navigateByUrl('/tabs/user/sessions');
  }

  private _coachMember(coach: MyInstructor): HiveMember {
    const user = coach.instructor;
    const handle = user.handle;
    const name = `${user.firstName} ${user.lastName}`.trim();
    return {
      key: `coach-${coach.id}`,
      name,
      shortName: user.firstName?.trim() || name,
      caption: this._translateService.instant('home.train.hive.coach'),
      imageUrl: user.avatarUrl ?? null,
      color: avatarToneFor(user.id),
      // The profile in Home's own stack; a coach with no handle has none to
      // open, so their row in My coaches instead.
      open: () =>
        handle
          ? void this._router.navigate([personBase(ProfileStacks.Home), handle])
          : void this._router.navigateByUrl(ProfileStacks.Coaches),
    };
  }

  private _groupMember(group: GroupWithMyRole): HiveMember {
    return {
      key: `group-${group.id}`,
      name: group.name,
      shortName: group.name,
      caption: this._translateService.instant('home.train.hive.group'),
      imageUrl: group.logoUrl,
      color: GROUP_AVATAR_TONE,
      open: () => void this._router.navigate([groupBase(ProfileStacks.Home), group.id]),
    };
  }
}
