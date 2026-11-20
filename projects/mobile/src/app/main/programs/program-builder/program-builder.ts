import {
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
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
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  NavController,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import {
  Program,
  ProgramAssignmentService,
  ProgramService,
  ProgramStatus,
  ProgramWorkout,
  estimateWorkoutMinutes,
  weekdayNames,
  workoutExerciseCount,
} from 'core';

import { ActionSheet } from '../../../_shared/components/action-sheet/action-sheet';
import { ConfirmFact, ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { Notice } from '../../../_shared/components/notice/notice';
import { FeedbackService, UndoToast } from '../../../_shared/services/feedback.service';
import { CoachStacks, coachStackOf } from '../../clients/client-paths';
import { AssignRequest, AssignSheet } from '../_sheets/assign-sheet/assign-sheet';
import { CopyDaySheet } from '../_sheets/copy-day-sheet/copy-day-sheet';
import { CopyWeekSheet } from '../_sheets/copy-week-sheet/copy-week-sheet';
import { ProgramActionsSheet } from '../_sheets/program-actions-sheet/program-actions-sheet';
import { ProgramDetailsSheet } from '../_sheets/program-details-sheet/program-details-sheet';
import {
  DEFAULT_PROGRAM_WEEKS,
  dayLabels,
  deleteWeekShift,
  hasProgramName,
  isOwnProgram,
  PROGRAM_ICONS,
  ProgramActionId,
  ProgramActionIds,
  WeekActionId,
  WeekActionIds,
  weekActions,
  weekLabel,
  weeksToDays,
} from '../programs.config';
import { ProgramBuilderStore, ProgramDetailsChange, WeekCard } from './program-builder.store';

/** The URL segment that means "a program that does not exist yet". */
const NEW = 'new';

/**
 * Translation key for the name a fresh draft is born with. Matched on leave
 * to tell an untouched draft from one the coach actually started — renaming
 * it is the first thing anyone does, so it is a reliable signal. The
 * language is fixed per page load, so the name born here is the name
 * compared against on the way out.
 */
const UNTOUCHED_DRAFT_NAME_KEY = 'programs.builder.untitledProgram';

/**
 * The draft `new` just made, handed to the page that opens under its id:
 * that page shows it at once instead of loading it again, so creating a
 * program reads as one screen, not a screen and then a second one.
 */
let handedDraft: Program | null = null;

/**
 * The program builder — vertical weeks.
 *
 * One week is one card and a day is a named row, so a coach edits by reading
 * rather than by remembering which cell was which. The alternative considered
 * was a true week×day matrix: a better shape-of-the-plan overview, but its
 * cells are anonymous, seven columns of 44px targets do not fit a phone, and
 * it speaks a visual language nothing else in the app uses.
 *
 * Rest days are absences, not records: a day with no `program_workout` row is
 * a rest day, which keeps "clear this day" a delete rather than a state.
 */
@Component({
  selector: 'mh-program-builder',
  imports: [
    ActionSheet,
    AssignSheet,
    ConfirmSheet,
    CopyDaySheet,
    CopyWeekSheet,
    EmptyState,
    IonBackButton,
    IonBadge,
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
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    Notice,
    ProgramActionsSheet,
    ProgramDetailsSheet,
    TranslatePipe,
  ],
  providers: [ProgramBuilderStore],
  templateUrl: './program-builder.html',
  styleUrl: './program-builder.scss',
})
export class ProgramBuilder implements ViewWillEnter, ViewWillLeave {
  readonly store = inject(ProgramBuilderStore);
  private readonly _programService = inject(ProgramService);
  private readonly _programAssignmentService = inject(ProgramAssignmentService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _navController = inject(NavController);
  /** Programs, or Clients when the plan was opened from a client's page. */
  readonly stack = coachStackOf(this._router.url);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _injector = inject(Injector);

  readonly dayLabels = dayLabels();
  /** Whole weekday names, for the sentence a cleared day's toast says. */
  private readonly _longDayLabels = weekdayNames('long');
  readonly weekLabel = weekLabel;
  readonly skeletonWeeks = [1, 2];
  readonly skeletonRows = [1, 2, 3];

  readonly copyOpen = signal(false);
  readonly copyFrom = signal(0);

  private _id: string | null = null;
  /**
   * The draft just created reopens under its own id (`_createDraft`). Ionic
   * shows the id's address as a new page and closes this one, so this page
   * leaves: the draft must not be thrown away as abandoned, or every edit on
   * the new page answers "program not found".
   */
  private _replacedByDraft = false;

  /**
   * Which weeks show their days. Only the first when a program opens: with
   * every week open a twelve-week plan is eighty-four rows of scrolling, and
   * the rail already jumps anywhere. Kept while this screen lives, so coming
   * back from a day lands on the weeks the coach left open.
   */
  readonly openWeeks = signal<ReadonlySet<number>>(new Set([0]));
  /** The program `openWeeks` describes; another program starts closed again. */
  private _openFor: string | null = null;

  readonly title = computed(
    () => this.store.program()?.name ?? this._translateService.instant('programs.builder.titleFallback'),
  );

  /**
   * "4 weeks · 8 days of work · Draft": its size, then a state that is not
   * the published one. Published is said by the badge beside this line.
   */
  readonly subtitle = computed(() => {
    const program = this.store.program();
    const size = this._translateService.instant('programs.builder.subtitle', {
      weeks: this.store.weekCount(),
      days: this.store.filledDays(),
    });
    if (!program) {
      return size;
    }
    if (program.status === ProgramStatus.Published) {
      return size;
    }
    const status = this._translateService.instant(`enum.programStatus.${program.status}`);
    return `${size} · ${status}`;
  });

  /**
   * Said above the weeks of a published program clients follow: edits here
   * reach only new assignments, since each client trains their own copy.
   */
  readonly showClientsNotice = computed(
    () => this.store.isPublished() && this.isOwn() && this.store.clientCount() > 0,
  );

  readonly clientsNotice = computed(() =>
    this._translateService.instant('programs.builder.clientsNotice', {
      count: this.store.clientCount(),
    }),
  );

  /** The undo offered for the last cleared day, while it is on screen. */
  private _undoToast: UndoToast | null = null;

  constructor() {
    addIcons(PROGRAM_ICONS);
    // A held clear sent for another reason (a copy, a publish) can no longer
    // be undone, so its toast goes with it.
    effect(() => {
      if (this.store.pendingClearId() === null) {
        void this._dismissUndo();
      }
    });
  }

  /**
   * Throw away a draft nobody used.
   *
   * Tapping "new" has to create a real row immediately, because days need a
   * program id to hang off. Backing out without naming it used to leave that
   * row behind — the list filled with "Untitled program", some with no days
   * at all. Only an untouched one is discarded: still the birth name, and
   * nothing scheduled.
   */
  ionViewWillLeave(): void {
    // A cleared day is deleted for real once the coach moves on, and its
    // undo goes with the page it was offered on.
    this.store.flushClear();
    void this._dismissUndo();

    if (this._replacedByDraft) {
      this._replacedByDraft = false;
      return;
    }
    const program = this.store.program();
    if (!program || !this._id || this._id === NEW) return;
    if (program.name !== this._translateService.instant(UNTOUCHED_DRAFT_NAME_KEY)) return;
    if (this.store.workouts().length > 0) return;

    const id = this._id;
    this._id = null;
    // Silent on failure: the coach has already left, and a toast about a
    // draft they abandoned is noise. The row simply stays.
    this._programService.remove(id).pipe(take(1)).subscribe({ error: () => undefined });
  }

  ionViewWillEnter(): void {
    const id = this._route.snapshot.paramMap.get('id');

    if (id === NEW) {
      if (this._id === NEW && this.store.program()) return;
      this._id = NEW;
      this._createDraft();
      return;
    }

    if (!id) return;
    if (id !== this._openFor) {
      this._openFor = id;
      this.openWeeks.set(new Set([0]));
    }
    this._id = id;
    const draft = handedDraft;
    handedDraft = null;
    if (draft && draft.id === id) {
      this.store.adopt(draft);
      return;
    }
    // Always re-read: a day edited on the pushed screen changes this grid.
    this.store.load(id);
  }

  // ─── Open and closed weeks ────────────────────────────────────

  isWeekOpen(index: number): boolean {
    return this.openWeeks().has(index);
  }

  toggleWeek(index: number): void {
    this.openWeeks.update((open) => {
      const next = new Set(open);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  /** The days with work in a closed week, so it can be judged unopened. */
  weekEntries(week: WeekCard): { day: number; label: string; name: string }[] {
    return week.days.flatMap((day, index) =>
      day ? [{ day: index, label: this.dayLabels[index], name: day.name }] : [],
    );
  }

  retry(): void {
    this.ionViewWillEnter();
  }

  // ─── Grid ─────────────────────────────────────────────────────

  daysLabel(week: WeekCard): string {
    return this._translateService.instant('programs.builder.daysFilled', {
      filled: week.filled,
      total: week.days.length,
    });
  }

  openDay(week: WeekCard, dayIndex: number): void {
    const program = this.store.program();
    if (!program) return;

    const existing = week.days[dayIndex];
    if (existing) {
      void this._router.navigate([this.stack, 'program', program.id, 'day', existing.id]);
      return;
    }

    // An empty cell creates the day, then opens it — one tap, not two.
    this.store.addDay(week.index, dayIndex, (workoutId) => {
      void this._router.navigate([this.stack, 'program', program.id, 'day', workoutId]);
    });
  }

  /**
   * The X on a day: the day leaves the grid at once, with no confirm (owner
   * decision, 2026-11-20). Its delete waits for the undo toast to close, so
   * Undo puts it back as it was without asking the server.
   */
  clearDay(day: ProgramWorkout, event: Event): void {
    // Inside the row's own tap target; without this the tap also opens the day.
    event.stopPropagation();
    const cleared = this.store.clearDay(day.id);
    if (!cleared) {
      return;
    }
    void this._offerUndo(cleared);
  }

  /** "5 exercises · ~55 min": what a day holds, and about how long it takes. */
  dayMeta(day: ProgramWorkout): string {
    const count = workoutExerciseCount(day);
    if (count === 0) {
      return this._translateService.instant('programs.builder.dayEmpty');
    }
    const minutes = estimateWorkoutMinutes(day);
    if (minutes === null) {
      return this._translateService.instant('count.exercises', { count });
    }
    return this._translateService.instant('programs.builder.dayMeta', { count, minutes });
  }

  private async _offerUndo(day: ProgramWorkout): Promise<void> {
    await this._dismissUndo();
    const toast = await this._feedbackService.undoable(
      this._translateService.instant('programs.builder.toast.dayCleared', {
        day: this._longDayLabels[day.dayIndex],
      }),
      this._translateService.instant('button.undo'),
    );
    // Sent already (the page left, another write went first): nothing to undo.
    if (this.store.pendingClearId() !== day.id) {
      await toast.dismiss();
      return;
    }
    this._undoToast = toast;
    const undone = await toast.undone;
    if (this._undoToast === toast) {
      this._undoToast = null;
    }
    if (undone) {
      this.store.undoClear(day.id);
      return;
    }
    this.store.flushClear(day.id);
  }

  private async _dismissUndo(): Promise<void> {
    const toast = this._undoToast;
    if (!toast) {
      return;
    }
    this._undoToast = null;
    await toast.dismiss();
  }

  // ─── A week's ⋯ ───────────────────────────────────────────────

  /** The week whose ⋯ sheet, or one of its confirms, is open. */
  readonly weekMenuIndex = signal<number | null>(null);
  readonly weekMenuOpen = signal(false);

  private readonly _weekMenuWeek = computed<WeekCard | null>(() => {
    const index = this.weekMenuIndex();
    if (index === null) {
      return null;
    }
    const week = this.store.weeks()[index];
    if (!week) {
      return null;
    }
    return week;
  });

  readonly weekMenuTitle = computed(() => {
    const index = this.weekMenuIndex();
    if (index === null) {
      return '';
    }
    return weekLabel(index);
  });

  /** "3 days with exercises", under the week's name. */
  readonly weekMenuSubtitle = computed(() => {
    const week = this._weekMenuWeek();
    if (!week) {
      return '';
    }
    return this._translateService.instant('programs.builder.weekMenu.subtitle', {
      count: this._daysWithExercises(week),
    });
  });

  readonly weekMenuActions = computed(() => {
    const week = this._weekMenuWeek();
    if (!week) {
      return [];
    }
    return weekActions({ days: week.filled, weekCount: this.store.weekCount() });
  });

  openWeekMenu(weekIndex: number): void {
    this.weekMenuIndex.set(weekIndex);
    this.weekMenuOpen.set(true);
  }

  /** The sheet reports the verb once it has gone; the page does it. */
  onWeekAction(id: WeekActionId): void {
    const index = this.weekMenuIndex();
    if (index === null) {
      return;
    }
    switch (id) {
      case WeekActionIds.Copy:
        this.openCopy(index);
        return;
      case WeekActionIds.InsertAfter:
        this.insertWeekAfter(index);
        return;
      case WeekActionIds.Clear:
        this.clearWeekOpen.set(true);
        return;
      case WeekActionIds.Delete:
        this.deleteWeekOpen.set(true);
        return;
    }
  }

  /** Days of a week that hold at least one exercise. */
  private _daysWithExercises(week: WeekCard): number {
    let count = 0;
    for (const day of week.days) {
      if (day && workoutExerciseCount(day) > 0) {
        count += 1;
      }
    }
    return count;
  }

  /** The week's days as the confirms list them: "Mon · Push A". */
  private _weekDayFacts(week: WeekCard | null): ConfirmFact[] {
    if (!week) {
      return [];
    }
    const facts: ConfirmFact[] = [];
    week.days.forEach((day, index) => {
      if (day) {
        facts.push({ label: this.dayLabels[index], value: day.name });
      }
    });
    return facts;
  }

  /** The clients sentence a week's confirm ends on, or nothing when none follow it. */
  private _clientsKeepCopy(): string {
    const count = this.store.clientCount();
    if (count === 0) {
      return '';
    }
    return this._translateService.instant('programs.builder.weekMenu.clientsKeepCopy', { count });
  }

  // ─── Add a week after one ─────────────────────────────────────

  insertWeekAfter(weekIndex: number): void {
    this.store.insertWeekAfter(weekIndex, (error) => {
      if (error) {
        void this._feedbackService.error(
          error,
          this._translateService.instant('programs.builder.toast.addWeekFailed'),
        );
        return;
      }
      // The weeks after it moved down one, so their open state moves too,
      // and the new week opens where the coach will fill it.
      this.openWeeks.update((open) => {
        const next = new Set<number>();
        for (const week of open) {
          if (week > weekIndex) {
            next.add(week + 1);
          } else {
            next.add(week);
          }
        }
        next.add(weekIndex + 1);
        return next;
      });
      void this._feedbackService.success(
        this._translateService.instant('programs.builder.toast.weekAdded', {
          week: weekIndex + 2,
          after: weekIndex + 1,
        }),
      );
    });
  }

  // ─── Clear a week ─────────────────────────────────────────────

  readonly clearWeekOpen = signal(false);

  readonly clearWeekTitle = computed(() =>
    this._translateService.instant('programs.builder.clearWeek.title', {
      week: (this.weekMenuIndex() ?? 0) + 1,
    }),
  );

  /** What goes (its days, listed below), what stays, and who keeps a copy. */
  readonly clearWeekBody = computed(() => {
    const week = this._weekMenuWeek();
    if (!week) {
      return '';
    }
    const lead = this._translateService.instant('programs.builder.clearWeek.body', {
      days: week.filled,
    });
    return [lead, this._clientsKeepCopy()].filter(Boolean).join(' ');
  });

  readonly clearWeekFacts = computed(() => this._weekDayFacts(this._weekMenuWeek()));

  confirmClearWeek(): void {
    const index = this.weekMenuIndex();
    this.clearWeekOpen.set(false);
    if (index === null) {
      return;
    }
    this.store.clearWeek(index, (error) => {
      if (error) {
        void this._feedbackService.error(
          error,
          this._translateService.instant('programs.builder.toast.clearWeekFailed'),
        );
        return;
      }
      void this._feedbackService.success(
        this._translateService.instant('programs.builder.toast.weekCleared', { week: index + 1 }),
      );
    });
  }

  // ─── Delete a week ────────────────────────────────────────────

  readonly deleteWeekOpen = signal(false);

  readonly deleteWeekTitle = computed(() =>
    this._translateService.instant('programs.builder.deleteWeek.title', {
      week: (this.weekMenuIndex() ?? 0) + 1,
    }),
  );

  readonly deleteWeekConfirm = computed(() =>
    this._translateService.instant('programs.builder.deleteWeek.confirm', {
      week: (this.weekMenuIndex() ?? 0) + 1,
    }),
  );

  /**
   * Says what goes and who keeps a copy, before anything does (design
   * "WeekSheet"): its days are listed below, and the clients following the
   * program keep theirs unchanged.
   */
  readonly deleteWeekBody = computed(() => {
    const index = this.weekMenuIndex();
    const week = this._weekMenuWeek();
    if (index === null || !week) {
      return '';
    }
    const lead = this._translateService.instant('programs.builder.deleteWeek.body', {
      week: index + 1,
      days: week.filled,
    });
    return [lead, this._clientsKeepCopy()].filter(Boolean).join(' ');
  });

  readonly deleteWeekFacts = computed(() => this._weekDayFacts(this._weekMenuWeek()));

  /** "Weeks 3 to 8 move up and become weeks 2 to 7. The program ends up with 7 weeks." */
  readonly deleteWeekShift = computed(() => {
    const index = this.weekMenuIndex();
    if (index === null) {
      return null;
    }
    return deleteWeekShift(index, this.store.weekCount());
  });

  confirmDeleteWeek(): void {
    const index = this.weekMenuIndex();
    this.deleteWeekOpen.set(false);
    if (index === null) return;

    this.store.deleteWeek(index, (error) => {
      if (error) {
        void this._feedbackService.error(
          error,
          this._translateService.instant('programs.builder.toast.deleteWeekFailed'),
        );
        return;
      }
      // Later weeks moved up one, so their open state moves with them.
      this.openWeeks.update(
        (open) =>
          new Set([...open].filter((w) => w !== index).map((w) => (w > index ? w - 1 : w))),
      );
      void this._feedbackService.success(
        this._translateService.instant('programs.builder.toast.weekDeleted', { week: index + 1 }),
      );
    });
  }

  openCopy(weekIndex: number): void {
    this.copyFrom.set(weekIndex);
    this.copyOpen.set(true);
  }

  // ─── Copy a day across weeks ──────────────────────────────────

  readonly copyDayOpen = signal(false);
  readonly copyDayWeek = signal(0);
  readonly copyDayIndex = signal(0);
  readonly copyDayName = signal('');

  /**
   * Weeks that already hold training in the slot being copied — the sheet
   * turns this into the "will be replaced" warning. Computed here because
   * the page holds the program's shape; the sheet only renders it.
   */
  readonly copyDayOccupied = computed(() => {
    const day = this.copyDayIndex();
    return this.store
      .weeks()
      .filter((week) => week.index !== this.copyDayWeek() && !!week.days[day])
      .map((week) => week.index);
  });

  openCopyDay(
    weekIndex: number,
    dayIndex: number,
    day: ProgramWorkout,
    event: Event,
  ): void {
    // The row itself opens the day editor; this button must not do both.
    event.stopPropagation();
    this.copyDayWeek.set(weekIndex);
    this.copyDayIndex.set(dayIndex);
    this.copyDayName.set(day.name);
    this.copyDayOpen.set(true);
  }

  /**
   * One request for every target, unlike `onCopy` — the day endpoint takes
   * the whole list, so there is no chain to walk and no partial state if a
   * later week fails.
   */
  copyDayTo(choice: { weeks: number[]; toDayIndex?: number }): void {
    this.copyDayOpen.set(false);
    const targets = choice.weeks;
    if (!targets.length) return;

    const name = this.copyDayName();
    const movedDay =
      choice.toDayIndex !== undefined && choice.toDayIndex !== this.copyDayIndex();

    this.store.copyDay(
      this.copyDayWeek(),
      this.copyDayIndex(),
      targets,
      choice.toDayIndex,
      (error) => {
        if (error) {
          void this._feedbackService.error(
            error,
            this._translateService.instant('programs.builder.toast.copyDayFailed'),
          );
          return;
        }
        // Naming the day when it changed: "copied to week 2" would hide the
        // part the coach deliberately chose.
        if (movedDay) {
          void this._feedbackService.success(
            this._translateService.instant('programs.builder.toast.dayCopiedToDay', {
              name,
              day: this.dayLabels[choice.toDayIndex!],
              week: targets[0] + 1,
            }),
          );
          return;
        }
        void this._feedbackService.success(
          targets.length === 1
            ? this._translateService.instant('programs.builder.toast.dayCopiedToWeek', {
                name,
                week: targets[0] + 1,
              })
            : this._translateService.instant('programs.builder.toast.dayCopiedToWeeks', {
                name,
                count: targets.length,
              }),
        );
      },
    );
  }

  /**
   * Occupancy for every day of the week, so the sheet can answer "is the day
   * I just picked already taken?" without calling back into the page.
   *
   * Indexed by day: `copyDayTargetOccupied()[3]` is the weeks with something
   * on Thursday.
   */
  readonly copyDayTargetOccupied = computed(() =>
    this.dayLabels.map((_, dayIndex) =>
      this.store
        .weeks()
        .filter((week) => !!week.days[dayIndex])
        .map((week) => week.index),
    ),
  );

  /**
   * One request for every target week, never one per week: the server copies
   * them all in one transaction, so a failure leaves none half-copied.
   */
  onCopy(targets: number[]): void {
    const from = this.copyFrom();
    this.copyOpen.set(false);
    if (!targets.length) return;

    this.store.copyWeek(from, targets, (error) => {
      if (error) {
        void this._feedbackService.error(
          error,
          this._translateService.instant('programs.builder.toast.copyWeekFailed'),
        );
        return;
      }
      if (targets.length === 1) {
        void this._feedbackService.success(
          this._translateService.instant('programs.builder.toast.weekCopiedToWeek', {
            from: from + 1,
            week: targets[0] + 1,
          }),
        );
        return;
      }
      void this._feedbackService.success(
        this._translateService.instant('programs.builder.toast.weekCopiedToWeeks', {
          from: from + 1,
          count: targets.length,
        }),
      );
    });
  }

  // ─── Chrome ───────────────────────────────────────────────────

  /** A MotionHive starter can be copied and assigned, not changed. */
  readonly isOwn = computed(() => {
    const program = this.store.program();
    return !!program && isOwnProgram(program);
  });

  /**
   * The step this screen is waiting on, in the footer: Publish while your
   * program is a draft, then Assign once it is published, a starter's too
   * (owner decision, 2026-11-20, as the Builder design draws it; Assign is
   * no longer behind the ⋯).
   */
  readonly showPublishFooter = computed(() => {
    const program = this.store.program();
    if (!program || !this.isOwn()) {
      return false;
    }
    return program.status === ProgramStatus.Draft;
  });

  readonly showAssignFooter = computed(() => !!this.store.program() && this.store.isPublished());

  readonly showFooter = computed(() => this.showPublishFooter() || this.showAssignFooter());

  openAssign(): void {
    this.assignOpen.set(true);
  }

  /**
   * The publish rule, as the footer's checklist: a name someone gave it (the
   * untouched birth name, in either language, is none) and at least one day
   * with an exercise in it. The API refuses the same two.
   */
  readonly hasName = computed(() => {
    const program = this.store.program();
    if (!program) {
      return false;
    }
    return hasProgramName(program.name);
  });

  readonly hasDayWithExercises = computed(() => this.store.exerciseDays() > 0);

  readonly canPublish = computed(() => this.hasName() && this.hasDayWithExercises());

  /** "8 weeks, 24 days with exercises. After publishing you can assign it." */
  readonly publishReady = computed(() =>
    this._translateService.instant('programs.builder.publish.ready', {
      weeks: this.store.weekCount(),
      days: this.store.exerciseDays(),
    }),
  );

  /** The checklist's way to a name. */
  openDetails(): void {
    this.detailsOpen.set(true);
  }

  /**
   * The checklist's way to exercises: the first day there is, or else a new
   * one on the first week's first day, opened the way a rest cell opens.
   */
  openFirstDay(): void {
    const program = this.store.program();
    if (!program) {
      return;
    }
    const first = this.store.firstDay();
    if (first) {
      void this._router.navigate([this.stack, 'program', program.id, 'day', first.id]);
      return;
    }
    const week = this.store.weeks()[0];
    if (!week) {
      return;
    }
    this.openDay(week, 0);
  }

  /** Both lead off this page, so each is closed before navigating (see ConfirmSheet.close). */
  private readonly _duplicateSheet = viewChild<ConfirmSheet>('duplicateSheet');
  private readonly _deleteSheet = viewChild<ConfirmSheet>('deleteSheet');

  readonly actionsOpen = signal(false);
  readonly detailsOpen = signal(false);
  readonly duplicateOpen = signal(false);
  readonly deleteOpen = signal(false);
  readonly assignOpen = signal(false);
  readonly assignSaving = signal(false);

  readonly duplicateBody = computed(() =>
    this._translateService.instant('programs.duplicate.body', {
      name: this.store.program()?.name ?? '',
    }),
  );

  readonly deleteBody = computed(() => {
    const name = this.store.program()?.name;
    return name
      ? this._translateService.instant('programs.settings.delete.body', { name })
      : this._translateService.instant('programs.settings.delete.bodyFallback');
  });

  openActions(): void {
    this.actionsOpen.set(true);
  }

  /** The sheet reports the verb; this screen decides what it means. */
  onAction(id: ProgramActionId): void {
    switch (id) {
      case ProgramActionIds.EditDetails:
        this.detailsOpen.set(true);
        return;
      case ProgramActionIds.ViewAssignments:
        this.openAssignments();
        return;
      case ProgramActionIds.Duplicate:
        this.duplicateOpen.set(true);
        return;
      case ProgramActionIds.Unpublish:
        this.unpublish();
        return;
      case ProgramActionIds.Delete:
        this.deleteOpen.set(true);
        return;
    }
  }

  saveDetails(change: ProgramDetailsChange): void {
    this.store.saveDetails(change, (error, repeatFailed) => {
      if (error && !repeatFailed) {
        void this._feedbackService.error(
          error,
          this._translateService.instant('programs.settings.toast.saveFailed'),
        );
        return;
      }
      // Saved either way once the first request landed; a failed repeat only
      // leaves the new weeks empty, so the sheet closes and says so.
      this.detailsOpen.set(false);
      if (repeatFailed) {
        void this._feedbackService.error(
          error,
          this._translateService.instant('programs.settings.toast.repeatFailed'),
        );
        return;
      }
      void this._feedbackService.success(this._translateService.instant('toast.summary.saved'));
    });
  }

  /** Straight away: it undoes cleanly from the ⋯, and nobody sees a draft change. */
  publish(): void {
    if (!this.canPublish()) {
      return;
    }
    this.store.setStatus(ProgramStatus.Published, (error) => {
      if (error) {
        void this._feedbackService.error(
          error,
          this._translateService.instant('programs.settings.toast.saveFailed'),
        );
        return;
      }
      void this._feedbackService.success(
        this._translateService.instant('programs.settings.toast.published'),
      );
    });
  }

  /** Back to draft, to rework it. Clients already on the plan keep their own copy. */
  unpublish(): void {
    this.store.setStatus(ProgramStatus.Draft, (error) => {
      if (error) {
        void this._feedbackService.error(
          error,
          this._translateService.instant('programs.settings.toast.unpublishFailed'),
        );
        return;
      }
      void this._feedbackService.success(
        this._translateService.instant('programs.settings.toast.unpublished'),
      );
    });
  }

  /**
   * Lands on the copy rather than staying here: the reason to duplicate is to
   * change something, and the thing to change is the new one.
   */
  confirmDuplicate(): void {
    this.store.duplicate(async (copy, error) => {
      if (!copy) {
        void this._feedbackService.error(
          error,
          this._translateService.instant('programs.settings.toast.duplicateFailed'),
        );
        return;
      }
      await this._duplicateSheet()?.close();
      void this._feedbackService.success(
        this._translateService.instant('programs.settings.toast.duplicated'),
      );
      void this._router.navigate([this.stack, 'program', copy.id], { replaceUrl: true });
    });
  }

  confirmDelete(): void {
    this.store.remove(async (error) => {
      if (error) {
        void this._feedbackService.error(
          error,
          this._translateService.instant('programs.settings.toast.deleteFailed'),
        );
        return;
      }
      // Gone already: nothing for the untouched-draft cleanup to delete on leave.
      this._id = null;
      await this._deleteSheet()?.close();
      void this._feedbackService.success(
        this._translateService.instant('programs.settings.toast.deleted'),
      );
      // Past the deleted plan: to the list on the Programs tab, and from a
      // client's page back to it.
      if (this.stack === CoachStacks.Programs) {
        void this._router.navigate([this.stack], { replaceUrl: true });
      } else {
        void this._navController.back();
      }
    });
  }

  openAssignments(): void {
    const program = this.store.program();
    if (program) void this._router.navigate([this.stack, 'program', program.id, 'assignments']);
  }

  onAssign(request: AssignRequest): void {
    const program = this.store.program();
    if (!program || this.assignSaving()) return;
    this.assignSaving.set(true);
    this._programAssignmentService
      // This program last, so nothing in the sheet's payload can override it.
      .assign({ ...request, programId: program.id })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.assignSaving.set(false);
          this.assignOpen.set(false);
          void this._feedbackService.success(
            this._translateService.instant('programs.assignments.toast.assigned'),
          );
        },
        error: (error: unknown) => {
          this.assignSaving.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('programs.assignments.toast.assignFailed'),
          );
        },
      });
  }

  /**
   * The rail opens the week it jumps to, then scrolls once its rows have a
   * height. Ionic's list lays itself out a beat after Angular renders it, so
   * scrolling on render alone fell short on a late week: the page still
   * ended before the week could reach the top.
   */
  scrollToWeek(index: number): void {
    const scroll = () =>
      document
        .getElementById(`week-${index}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (this.isWeekOpen(index)) {
      scroll();
      return;
    }
    this.toggleWeek(index);
    afterNextRender(
      {
        read: () => {
          const list = document.getElementById(`week-days-${index}`) as
            | (HTMLElement & { componentOnReady?: () => Promise<unknown> })
            | null;
          void Promise.resolve(list?.componentOnReady?.()).then(() =>
            requestAnimationFrame(scroll),
          );
        },
      },
      { injector: this._injector },
    );
  }

  /**
   * A program needs a row before it can hold days, so `new` creates one
   * immediately as a draft and swaps the URL for its id. Saving an unfinished
   * draft is always allowed; it is assigning one that is not.
   */
  private _createDraft(): void {
    this._programService
      .create({
        name: this._translateService.instant(UNTOUCHED_DRAFT_NAME_KEY),
        durationDays: weeksToDays(DEFAULT_PROGRAM_WEEKS),
      })
      .pipe(take(1))
      .subscribe({
        next: (program) => {
          const draft = { ...program, workouts: program.workouts ?? [] };
          this.store.adopt(draft);
          this._id = program.id;
          // Same program under its real id: keep the weeks as they are.
          this._openFor = program.id;
          this._replacedByDraft = true;
          // The same screen under its real address: no slide, and the page
          // that opens takes the draft as it is rather than loading again.
          handedDraft = draft;
          void this._navController.navigateForward([this.stack, 'program', program.id], {
            replaceUrl: true,
            animated: false,
          });
        },
        error: (err) => {
          void this._feedbackService.error(
            err,
            this._translateService.instant('programs.builder.toast.startFailed'),
          );
          void this._router.navigate([this.stack]);
        },
      });
  }
}
