import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, map, Observable, of, take } from 'rxjs';

import {
  ClientService,
  GroupService,
  GroupWithMyRole,
  localDayKey,
  MyInstructor,
  MyTab,
  Post,
  PostService,
  ProgramAssignmentService,
  ProgressRecord,
  ProgressService,
  SessionParticipant,
  SessionService,
  TrainingDay,
  TrainingDayWorkout,
  WorkoutLog,
  WorkoutLogService,
} from 'core';

import { traineeLatest, weekDays, weekRange, weekSummary } from '../home.config';

/** A week of workouts fits many times over; the API caps a page at 100. */
const WEEK_LOG_LIMIT = 50;
/** Latest shows every post of the last 24 hours, up to ten, with records among them. */
const FEED_LIMIT = 20;
/** Enough upcoming bookings to find today's among them. */
const SESSIONS_LIMIT = 5;

/**
 * Data behind the trainee Home: the week, today's workout, the people in
 * your hive, and Latest (their posts and your records).
 *
 * All of it is read from what the app already serves: the plan's week
 * (`/my/workouts/today`), this week's finished workouts (History's list),
 * the open session, the streak and records (Progress), your coaches and
 * groups, the groups' feed and today's bookings. Each block loads on its own
 * and a failure empties only its block; the week card says so and offers a
 * retry, as the coach's hive card does. Every read is silent: a dialog over
 * the whole Home for one block's failure said it twice. Bills are not here:
 * the Menu's Billing row carries the dot.
 */
@Injectable()
export class TrainHomeStore {
  private readonly _programAssignmentService = inject(ProgramAssignmentService);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _progressService = inject(ProgressService);
  private readonly _clientService = inject(ClientService);
  private readonly _groupService = inject(GroupService);
  private readonly _postService = inject(PostService);
  private readonly _sessionService = inject(SessionService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _today = signal(new Date());
  private readonly _trainingDay = signal<TrainingDay | null>(null);
  private readonly _weekLogs = signal<WorkoutLog[]>([]);
  private readonly _inProgress = signal<WorkoutLog | null>(null);
  private readonly _streakWeeks = signal(0);
  private readonly _records = signal<ProgressRecord[]>([]);
  private readonly _coaches = signal<MyInstructor[]>([]);
  private readonly _groups = signal<GroupWithMyRole[]>([]);
  private readonly _posts = signal<Post[]>([]);
  private readonly _bookings = signal<SessionParticipant[]>([]);

  private readonly _weekLoading = signal(true);
  /** The last load of the week failed (either of its two reads). */
  private readonly _weekFailed = signal(false);
  /** A whole week has loaded at least once: a failed reload keeps showing it. */
  private readonly _weekShown = signal(false);
  /** Set on an answer only: a failed read is not "nobody". */
  private readonly _coachesLoaded = signal(false);
  private readonly _groupsLoaded = signal(false);
  /** Each read has answered at least once, either way: its block can stop shimmering. */
  private readonly _coachesAnswered = signal(false);
  private readonly _groupsAnswered = signal(false);
  private readonly _feedAnswered = signal(false);
  private readonly _progressAnswered = signal(false);

  readonly inProgress = this._inProgress.asReadonly();
  readonly streakWeeks = this._streakWeeks.asReadonly();
  readonly coaches = this._coaches.asReadonly();
  readonly groups = this._groups.asReadonly();

  /**
   * What the week card is drawn from (`loadState` in `home.config.ts`): it
   * builds until both the plan and the week's workouts are in, and a failed
   * reload keeps the week it showed.
   */
  readonly weekShown = this._weekShown.asReadonly();
  readonly weekLoading = this._weekLoading.asReadonly();
  readonly weekFailed = this._weekFailed.asReadonly();

  /**
   * Both people reads answered. A failure leaves it false, so "Build your
   * hive" is never offered to someone whose coaches did not load.
   */
  readonly peopleLoaded = computed(() => this._coachesLoaded() && this._groupsLoaded());

  /**
   * Both people reads answered once, either way: the first load's
   * placeholder row gives way, to the people, to "Build your hive", or to
   * nothing on a failure. A reload never brings it back.
   */
  readonly peopleAnswered = computed(() => this._coachesAnswered() && this._groupsAnswered());

  /** Latest's two reads (the feed, and the records in Progress) answered once. */
  readonly latestAnswered = computed(() => this._feedAnswered() && this._progressAnswered());

  readonly plan = computed<TrainingDayWorkout[]>(() => this._trainingDay()?.week ?? []);

  readonly days = computed(() => weekDays(this._today(), this._weekLogs(), this.plan()));
  readonly summary = computed(() => weekSummary(this.days(), this.plan(), localDayKey(this._today())));

  /**
   * The plan day the card offers: today's while it is still to do, else the
   * next one this week. A finished or skipped today offers nothing.
   */
  readonly nextWorkout = computed<{ workout: TrainingDayWorkout; isToday: boolean } | null>(() => {
    const day = this._trainingDay();
    if (!day) return null;
    if (day.today) return day.today.status === null ? { workout: day.today, isToday: true } : null;
    const todayKey = localDayKey(this._today());
    const next = day.week.find((w) => !!w.scheduledDate && w.scheduledDate > todayKey && w.status === null);
    return next ? { workout: next, isToday: false } : null;
  });

  /** Your groups' posts and your own records of the last two weeks, newest first. */
  readonly latest = computed(() => traineeLatest(this._posts(), this._records(), this._today()));

  /** Bookings that start today, soonest first. */
  readonly todayBookings = computed(() => {
    const todayKey = localDayKey(this._today());
    return this._bookings().filter(
      (booking) => !!booking.instance && localDayKey(new Date(booking.instance.startAt)) === todayKey,
    );
  });

  /** Every block. `done` runs once all of them have answered. */
  load(done?: () => void): void {
    this._today.set(new Date());
    const settle = countdown(8, done);
    this._loadWeek(settle);
    this._loadInProgress(settle);
    this._loadProgress(settle);
    this._loadCoaches(settle);
    this._loadGroups(settle);
    this._loadFeed(settle);
    this._loadBookings(settle);
  }

  /**
   * Two reads, so `settle` is called twice; the card waits for both, and
   * says it failed when either did (half a week would draw a wrong one).
   */
  private _loadWeek(settle: () => void): void {
    const today = this._today();
    let failed = false;
    this._weekLoading.set(true);
    const both = countdown(2, () => {
      this._weekFailed.set(failed);
      if (!failed) this._weekShown.set(true);
      this._weekLoading.set(false);
    });

    // Today is the reader's own calendar day, not the server's.
    const day = this._programAssignmentService.trainingDay(localDayKey(today), { silent: true });
    this._read(day, settle).subscribe((answer) => {
      if (answer) this._trainingDay.set(answer);
      else failed = true;
      both();
    });

    const logs = this._workoutLogService.list(
      { ...weekRange(today), limit: WEEK_LOG_LIMIT },
      { silent: true },
    );
    this._read(logs, settle).subscribe((page) => {
      if (page) this._weekLogs.set(page.items);
      else failed = true;
      both();
    });
  }

  /**
   * 200 with a null body when nothing is open, so null is an answer here:
   * a failure keeps whatever was known rather than hiding an open workout.
   */
  private _loadInProgress(settle: () => void): void {
    this._workoutLogService
      .getInProgress({ silent: true })
      .pipe(
        take(1),
        map((log): { log: WorkoutLog | null } => ({ log })),
        catchError(() => of(null)),
        finalize(settle),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((answer) => {
        if (answer) this._inProgress.set(answer.log);
      });
  }

  /** The streak and recent records; the shortest range, they are not windowed by it. */
  private _loadProgress(settle: () => void): void {
    this._read(this._progressService.overview('4w', { silent: true }), settle).subscribe(
      (overview) => {
        this._streakWeeks.set(overview?.streak.currentWeeks ?? 0);
        this._records.set(overview?.records ?? []);
        this._progressAnswered.set(true);
      },
    );
  }

  private _loadCoaches(settle: () => void): void {
    this._read(this._clientService.getMyInstructors({ silent: true }), settle).subscribe(
      (rows) => {
        this._coachesAnswered.set(true);
        if (!rows) return;
        this._coaches.set(rows);
        this._coachesLoaded.set(true);
      },
    );
  }

  private _loadGroups(settle: () => void): void {
    this._read(this._groupService.getMyGroups({ silent: true }), settle).subscribe((groups) => {
      this._groupsAnswered.set(true);
      if (!groups) return;
      this._groups.set(groups);
      this._groupsLoaded.set(true);
    });
  }

  private _loadFeed(settle: () => void): void {
    this._read(this._postService.getFeed(1, FEED_LIMIT, { silent: true }), settle).subscribe(
      (page) => {
        this._posts.set(page?.items ?? []);
        this._feedAnswered.set(true);
      },
    );
  }

  private _loadBookings(settle: () => void): void {
    const bookings = this._sessionService.listMy(
      { tab: MyTab.Upcoming, limit: SESSIONS_LIMIT },
      { silent: true },
    );
    this._read(bookings, settle).subscribe((page) => this._bookings.set(page?.items ?? []));
  }

  /** One answer or null on a failure; `settle` runs either way. */
  private _read<T>(source: Observable<T>, settle: () => void): Observable<T | null> {
    return source.pipe(
      take(1),
      catchError(() => of(null)),
      finalize(settle),
      takeUntilDestroyed(this._destroyRef),
    );
  }
}

/** A callback that runs `done` on its `count`th call: "all of them answered". */
function countdown(count: number, done?: () => void): () => void {
  let left = count;
  return () => {
    left -= 1;
    if (left === 0) done?.();
  };
}
