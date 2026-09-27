import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import { ProgramService, ProgramWorkout } from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { CopyDaySheet } from '../_sheets/copy-day-sheet/copy-day-sheet';
import { CopyWeekSheet } from '../_sheets/copy-week-sheet/copy-week-sheet';
import {
  DAY_LABELS,
  DEFAULT_PROGRAM_WEEKS,
  PROGRAM_ICONS,
  weekLabel,
  weeksToDays,
} from '../programs.config';
import { ProgramBuilderStore, WeekCard } from './program-builder.store';

/** The URL segment that means "a program that does not exist yet". */
const NEW = 'new';

/**
 * The name a fresh draft is born with. Matched on leave to tell an untouched
 * draft from one the coach actually started — renaming it is the first thing
 * anyone does, so it is a reliable signal.
 */
const UNTOUCHED_DRAFT_NAME = 'Untitled program';

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
    ConfirmSheet,
    CopyDaySheet,
    CopyWeekSheet,
    EmptyState,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  providers: [ProgramBuilderStore],
  templateUrl: './program-builder.html',
  styleUrl: './program-builder.scss',
})
export class ProgramBuilder implements ViewWillEnter, ViewWillLeave {
  readonly store = inject(ProgramBuilderStore);
  private readonly _programService = inject(ProgramService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);

  readonly dayLabels = DAY_LABELS;
  readonly weekLabel = weekLabel;
  readonly skeletonWeeks = [1, 2];
  readonly skeletonRows = [1, 2, 3];

  readonly copyOpen = signal(false);
  readonly copyFrom = signal(0);
  readonly clearTarget = signal<ProgramWorkout | null>(null);
  readonly clearOpen = signal(false);

  private _id: string | null = null;

  readonly title = computed(() => this.store.program()?.name ?? 'Program');

  readonly subtitle = computed(() => {
    const weeks = this.store.weekCount();
    const days = this.store.filledDays();
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} · ${days} ${days === 1 ? 'day' : 'days'} of work`;
  });

  readonly clearBody = computed(() => {
    const day = this.clearTarget();
    return day
      ? `Clear ${day.name}? The day becomes a rest day and its exercises are removed.`
      : '';
  });

  constructor() {
    addIcons(PROGRAM_ICONS);
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
    const program = this.store.program();
    if (!program || !this._id || this._id === NEW) return;
    if (program.name !== UNTOUCHED_DRAFT_NAME) return;
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
    // Always re-read: a day edited on the pushed screen changes this grid.
    this._id = id;
    this.store.load(id);
  }

  retry(): void {
    this.ionViewWillEnter();
  }

  // ─── Grid ─────────────────────────────────────────────────────

  daysLabel(week: WeekCard): string {
    return `${week.filled} of ${week.days.length} days`;
  }

  openDay(week: WeekCard, dayIndex: number): void {
    const program = this.store.program();
    if (!program) return;

    const existing = week.days[dayIndex];
    if (existing) {
      void this._router.navigate(['/tabs/programs/program', program.id, 'day', existing.id]);
      return;
    }

    // An empty cell creates the day, then opens it — one tap, not two.
    this.store.addDay(week.index, dayIndex, (workoutId) => {
      void this._router.navigate(['/tabs/programs/program', program.id, 'day', workoutId]);
    });
  }

  askClear(day: ProgramWorkout, event: Event): void {
    // Inside the row's own tap target; without this the tap also opens the day.
    event.stopPropagation();
    this.clearTarget.set(day);
    this.clearOpen.set(true);
  }

  confirmClear(): void {
    const day = this.clearTarget();
    this.clearOpen.set(false);
    this.clearTarget.set(null);
    if (day) this.store.clearDay(day.id);
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
          void this._feedbackService.error(error, 'Could not copy the day');
          return;
        }
        // Naming the day when it changed: "copied to week 2" would hide the
        // part the coach deliberately chose.
        if (movedDay) {
          void this._feedbackService.success(
            `${name} copied to ${this.dayLabels[choice.toDayIndex!]}, week ${targets[0] + 1}`,
          );
          return;
        }
        void this._feedbackService.success(
          targets.length === 1
            ? `${name} copied to week ${targets[0] + 1}`
            : `${name} copied to ${targets.length} weeks`,
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

  onCopy(targets: number[]): void {
    const from = this.copyFrom();
    this.copyOpen.set(false);
    if (!targets.length) return;

    // One at a time so the later copies see the earlier ones committed.
    const next = (i: number): void => {
      if (i >= targets.length) {
        void this._feedbackService.success(
          targets.length === 1
            ? `Week ${from + 1} copied to week ${targets[0] + 1}`
            : `Week ${from + 1} copied to ${targets.length} weeks`,
        );
        return;
      }
      this.store.copyWeek(from, targets[i], (error) => {
        if (error) {
          void this._feedbackService.error(error, 'Could not copy the week');
          return;
        }
        next(i + 1);
      });
    };
    next(0);
  }

  // ─── Chrome ───────────────────────────────────────────────────

  openSettings(): void {
    const program = this.store.program();
    if (program) {
      void this._router.navigate(['/tabs/programs/program', program.id, 'settings']);
    }
  }

  scrollToWeek(index: number): void {
    document
      .getElementById(`week-${index}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * A program needs a row before it can hold days, so `new` creates one
   * immediately as a draft and swaps the URL for its id. Saving an unfinished
   * draft is always allowed; it is assigning one that is not.
   */
  private _createDraft(): void {
    this._programService
      .create({
        name: UNTOUCHED_DRAFT_NAME,
        durationDays: weeksToDays(DEFAULT_PROGRAM_WEEKS),
      })
      .pipe(take(1))
      .subscribe({
        next: (program) => {
          this.store.adopt({ ...program, workouts: program.workouts ?? [] });
          this._id = program.id;
          void this._router.navigate(['/tabs/programs/program', program.id], {
            replaceUrl: true,
          });
        },
        error: (err) => {
          void this._feedbackService.error(err, 'Could not start the program');
          void this._router.navigate(['/tabs/programs']);
        },
      });
  }
}
