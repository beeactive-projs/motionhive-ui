import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import { ProgramService, ProgramWorkout } from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { CopyWeekSheet } from '../_sheets/copy-week-sheet/copy-week-sheet';
import { PROGRAM_ICONS, weeksToDays } from '../programs.config';
import { ProgramBuilderStore, WeekCard } from './program-builder.store';

/** Monday-first labels for the seven day columns. */
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const NEW_PROGRAM_WEEKS = 4;

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
    CopyWeekSheet,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  providers: [ProgramBuilderStore],
  templateUrl: './program-builder.html',
  styleUrl: './program-builder.scss',
})
export class ProgramBuilder implements ViewWillEnter {
  readonly store = inject(ProgramBuilderStore);
  private readonly _programService = inject(ProgramService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedback = inject(FeedbackService);

  readonly dayLabels = DAY_LABELS;
  readonly skeletonWeeks = [1, 2, 3];

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

  ionViewWillEnter(): void {
    const id = this._router.url.split('?')[0].split('/').pop() ?? null;

    if (id === 'new') {
      if (this._id === 'new' && this.store.program()) return;
      this._id = 'new';
      this._createDraft();
      return;
    }

    if (!id) return;
    // Always re-read: a day edited on the pushed screen changes this grid.
    this._id = id;
    this.store.load(id);
  }

  // ─── Grid ─────────────────────────────────────────────────────

  openDay(week: WeekCard, dayIndex: number): void {
    const program = this.store.program();
    if (!program) return;

    const existing = week.days[dayIndex];
    if (existing) {
      void this._router.navigate([
        '/tabs/programs/program',
        program.id,
        'day',
        existing.id,
      ]);
      return;
    }

    // An empty cell creates the day, then opens it — one tap, not two.
    this.store.addDay(week.index, dayIndex, (workoutId) => {
      void this._router.navigate(['/tabs/programs/program', program.id, 'day', workoutId]);
    });
  }

  askClear(day: ProgramWorkout, event: Event): void {
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

  onCopy(targets: number[]): void {
    const from = this.copyFrom();
    this.copyOpen.set(false);
    if (!targets.length) return;

    // One at a time so the later copies see the earlier ones committed.
    const next = (i: number): void => {
      if (i >= targets.length) {
        void this._feedback.success(
          targets.length === 1
            ? `Week ${from + 1} copied to week ${targets[0] + 1}`
            : `Week ${from + 1} copied to ${targets.length} weeks`,
        );
        return;
      }
      this.store.copyWeek(from, targets[i], () => next(i + 1));
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
        name: 'Untitled program',
        durationDays: weeksToDays(NEW_PROGRAM_WEEKS),
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
          void this._feedback.error(err, 'Could not start the program');
          void this._router.navigate(['/tabs/programs']);
        },
      });
  }
}
