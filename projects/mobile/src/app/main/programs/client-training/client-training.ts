import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonProgressBar,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { forkJoin, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import {
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  WorkoutLog,
  WorkoutLogService,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { SessionRowSkeleton } from '../../../_shared/components/session-row-skeleton/session-row-skeleton';
import { LogRow } from '../../workouts/_components/log-row/log-row';
import { shortDayLabel } from '../../workouts/workouts.config';
import { PROGRAM_ICONS } from '../programs.config';

/** Enough plans and logs to answer "how is this person doing" in one read. */
const PLAN_LIMIT = 50;
const LOG_LIMIT = 25;

/**
 * One client's training — their active plan and what they have actually
 * logged.
 *
 * Reached from the client's own page rather than from the program, because
 * the question it answers is "how is this person doing", not "how is this
 * program doing".
 *
 * The list may be shorter than what the client did: freestyle work is theirs
 * unless they share it, and the API filters it out server-side. The page says
 * so, styled as a rule, rather than letting a coach read an incomplete list
 * as a lazy client.
 */
@Component({
  selector: 'mh-client-training',
  imports: [
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonProgressBar,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    LogRow,
    SessionRowSkeleton,
  ],
  templateUrl: './client-training.html',
  styleUrl: './client-training.scss',
})
export class ClientTraining implements ViewWillEnter {
  private readonly _programAssignmentService = inject(ProgramAssignmentService);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  readonly assignments = signal<ProgramAssignment[]>([]);
  readonly logs = signal<WorkoutLog[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal(false);

  readonly skeletonRows = [1, 2, 3];

  private _clientId: string | null = null;

  readonly activePlans = computed(() =>
    this.assignments().filter(
      (a) =>
        a.status === ProgramAssignmentStatus.Active ||
        a.status === ProgramAssignmentStatus.Pending,
    ),
  );

  /**
   * Whose training this is, for the header — "Training" alone made every
   * client's plan look like the same screen. Read off an assignment's
   * eager-loaded client rather than fetched: this page already has the rows,
   * and a second request for a title is not worth a spinner. A client with
   * nothing assigned yet has no row to read, and keeps the plain title.
   */
  readonly clientName = computed(() => {
    const client = this.assignments().find((a) => a.client)?.client;
    if (!client) return '';
    return [client.firstName, client.lastName].filter(Boolean).join(' ').trim();
  });

  readonly showSkeleton = computed(() => this.loading() && !this.loaded());
  readonly showError = computed(() => this.error() && !this.loaded());

  readonly isEmpty = computed(
    () => this.loaded() && !this.error() && !this.activePlans().length && !this.logs().length,
  );

  constructor() {
    addIcons(PROGRAM_ICONS);
  }

  // Always re-read: a workout the client logged since belongs here.
  ionViewWillEnter(): void {
    const id = this._route.snapshot.paramMap.get('clientId');
    if (!id) return;
    this._clientId = id;
    this.load();
  }

  load(): void {
    const clientId = this._clientId;
    if (!clientId) return;
    this.loading.set(true);
    this.error.set(false);

    forkJoin({
      assignments: this._programAssignmentService
        .listForInstructor({ clientId, limit: PLAN_LIMIT })
        .pipe(catchError(() => of(null))),
      logs: this._workoutLogService
        .listForClient(clientId, { limit: LOG_LIMIT })
        .pipe(catchError(() => of(null))),
    })
      .pipe(take(1))
      .subscribe(({ assignments, logs }) => {
        if (assignments) this.assignments.set(assignments.items);
        if (logs) this.logs.set(logs.items);
        // Only when neither read landed is there nothing to show.
        const failed = !assignments && !logs;
        this.error.set(failed);
        this.loaded.set(!failed);
        this.loading.set(false);
      });
  }

  /** "23% done · started Mon 1 Sep" */
  planSubline(plan: ProgramAssignment): string {
    return `${plan.completionPercent}% done · started ${shortDayLabel(plan.startDate)}`;
  }

  openLog(log: WorkoutLog): void {
    void this._router.navigate(['/tabs/clients/log', log.id]);
  }
}
