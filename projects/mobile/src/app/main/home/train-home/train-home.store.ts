import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, Observable, of, take } from 'rxjs';

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
 * and a failure empties only its block. Bills are not here: the Menu's
 * Billing row carries the dot.
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

  private readonly _weekLoaded = signal(false);
  private readonly _coachesLoaded = signal(false);
  private readonly _groupsLoaded = signal(false);

  readonly inProgress = this._inProgress.asReadonly();
  readonly streakWeeks = this._streakWeeks.asReadonly();
  readonly coaches = this._coaches.asReadonly();
  readonly groups = this._groups.asReadonly();

  /** The card shimmers until both the plan and the week's workouts are in. */
  readonly weekLoaded = this._weekLoaded.asReadonly();
  readonly peopleLoaded = computed(() => this._coachesLoaded() && this._groupsLoaded());

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

  /** Two reads, so `settle` is called twice; the card waits for both. */
  private _loadWeek(settle: () => void): void {
    const today = this._today();
    const both = countdown(2, () => this._weekLoaded.set(true));

    // Today is the reader's own calendar day, not the server's.
    this._read(this._programAssignmentService.trainingDay(localDayKey(today)), settle).subscribe(
      (day) => {
        if (day) this._trainingDay.set(day);
        both();
      },
    );

    const logs = this._workoutLogService.list({ ...weekRange(today), limit: WEEK_LOG_LIMIT });
    this._read(logs, settle).subscribe((page) => {
      if (page) this._weekLogs.set(page.items);
      both();
    });
  }

  private _loadInProgress(settle: () => void): void {
    // 200 with a null body when nothing is open.
    this._read(this._workoutLogService.getInProgress(), settle).subscribe((log) =>
      this._inProgress.set(log),
    );
  }

  /** The streak and recent records; the shortest range, they are not windowed by it. */
  private _loadProgress(settle: () => void): void {
    this._read(this._progressService.overview('4w'), settle).subscribe((overview) => {
      this._streakWeeks.set(overview?.streak.currentWeeks ?? 0);
      this._records.set(overview?.records ?? []);
    });
  }

  private _loadCoaches(settle: () => void): void {
    this._read(this._clientService.getMyInstructors(), settle).subscribe((rows) => {
      if (rows) this._coaches.set(rows);
      this._coachesLoaded.set(true);
    });
  }

  private _loadGroups(settle: () => void): void {
    this._read(this._groupService.getMyGroups(), settle).subscribe((groups) => {
      if (groups) this._groups.set(groups);
      this._groupsLoaded.set(true);
    });
  }

  private _loadFeed(settle: () => void): void {
    this._read(this._postService.getFeed(1, FEED_LIMIT), settle).subscribe((page) =>
      this._posts.set(page?.items ?? []),
    );
  }

  private _loadBookings(settle: () => void): void {
    const bookings = this._sessionService.listMy({ tab: MyTab.Upcoming, limit: SESSIONS_LIMIT });
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
