import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionPanel,
} from 'primeng/accordion';
import { SelectButton } from 'primeng/selectbutton';
import { Toast } from 'primeng/toast';

import { Exercises } from '../../instructor/exercises/exercises';
import { ProgramAssignmentService } from 'core';
import { MyPlans } from '../my-plans/my-plans';
import { Progress } from '../progress/progress';
import { RoutineLibrary } from '../my-workouts/routine-library/routine-library';
import { TodayPanel } from '../my-workouts/today-panel/today-panel';
import { WorkoutHistory } from '../workout-history/workout-history';

/**
 * Two lenses, one filter each.
 *
 * Overview is the timeline: your day anchored between what you have
 * done and what is coming. Routines is the undated library. They were
 * three lenses (Today / Plans / History) which turned out to be one
 * timeline at three magnifications, plus a library stacked underneath
 * the calendar that could never filter it.
 *
 * Plans are not a lens: their contents already appear as today's card
 * and as history rows. What a plan uniquely owns — the arc and the
 * pause control — is a card on the Overview, linking to the plan detail
 * page that already exists.
 */
type TrainingLens = 'today' | 'plans' | 'routines' | 'exercises';

/**
 * Training — the single home for a person's own training.
 *
 * This replaced three sibling nav items (My plans, Workouts, Progress)
 * that were one loop cut into thirds. Progress in particular was pure
 * arithmetic over the workout log, so the two were the same data at
 * different zoom levels sitting in different places; History now shows
 * the summary directly above the list it summarises.
 *
 * "My sessions" deliberately stays outside this: booking a class with a
 * coach is a different activity from training, not another view of it.
 */
@Component({
  selector: 'mh-training',
  standalone: true,
  imports: [
    FormsModule,
    SelectButton,
    Accordion,
    AccordionContent,
    AccordionHeader,
    AccordionPanel,
    Exercises,
    MyPlans,
    Progress,
    RoutineLibrary,
    Toast,
    TodayPanel,
    WorkoutHistory,
  ],
  // One per destination rather than one per lens: the lenses are all
  // this page, so a toast raised in any of them belongs to the same
  // surface and should not stack three containers on top of each other.
  providers: [MessageService, ConfirmationService],
  templateUrl: './training.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Training implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _assignmentService = inject(ProgramAssignmentService);
  private readonly _router = inject(Router);

  readonly lens = signal<TrainingLens>('today');

  /**
   * True once a coach has ever assigned something. Keyed on *ever*, not
   * on having an active one: keying it on active would make the tab
   * vanish the moment a programme finished, taking the history with it,
   * and a tab that disappears is worse than one that was never there.
   */
  readonly hasPlans = signal(false);

  readonly lensOptions = computed<{ label: string; value: TrainingLens }[]>(
    () => [
      { label: 'Today', value: 'today' as const },
      { label: 'Routines', value: 'routines' as const },
      ...(this.hasPlans()
        ? [{ label: 'Plans', value: 'plans' as const }]
        : []),
      { label: 'Exercises', value: 'exercises' as const },
    ],
  );

  /** Collapsed by default: the day is the reason you opened this. */
  readonly statsOpen = signal(false);

  onStatsToggle(value: unknown): void {
    this.statsOpen.set(value === '0');
  }

  readonly subtitle = computed(() => {
    switch (this.lens()) {
      case 'plans':
        return 'What you are working through.';
      case 'routines':
        return 'Workouts you can start any time.';
      case 'exercises':
        return 'Every movement in the catalog, and the ones you have made.';
      default:
        return 'Your day, and what you have done.';
    }
  });

  ngOnInit(): void {
    // Subscribed, not a one-off snapshot read. A child navigating to
    // `?view=…` changed the URL and nothing else, so in-app links into
    // another lens silently did nothing.
    // Ask once; the answer only changes when a coach acts, and the
    // PROGRAM_ASSIGNED notification is what tells them meanwhile.
    this._assignmentService
      .listForClient({ limit: 1 })
      .subscribe({
        next: (res) => this.hasPlans.set(res.total > 0),
        error: () => this.hasPlans.set(false),
      });

    this._route.queryParamMap
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((params) => {
        const view = params.get('view');
        const valid =
          view === 'routines' || view === 'plans' || view === 'exercises';
        // A stale ?view=plans link on an account with none falls back
        // rather than selecting a lens that is not on screen.
        this.lens.set(
          valid && !(view === 'plans' && !this.hasPlans()) ? view : 'today',
        );
      });
  }

  setLens(lens: TrainingLens): void {
    if (lens === this.lens()) return;
    this.lens.set(lens);
    // In the URL rather than in memory, so a lens survives a refresh and
    // can be linked to — the old separate routes could be, and losing
    // that would be a regression.
    void this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { view: lens === 'today' ? null : lens },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
