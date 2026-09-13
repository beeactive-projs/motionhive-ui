import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
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
import { forkJoin, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import {
  ProgramAssignment,
  ProgramAssignmentService,
  WorkoutLog,
  WorkoutLogService,
  dayDividerLabel,
  localDayKey,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { PROGRAM_ICONS, workoutDurationOf } from '../programs.config';

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
 * so, rather than letting a coach read an incomplete list as a lazy client.
 */
@Component({
  selector: 'mh-client-training',
  imports: [
    EmptyState,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './client-training.html',
  styleUrl: './client-training.scss',
})
export class ClientTraining implements ViewWillEnter {
  private readonly _assignmentService = inject(ProgramAssignmentService);
  private readonly _logService = inject(WorkoutLogService);
  private readonly _router = inject(Router);

  readonly assignments = signal<ProgramAssignment[]>([]);
  readonly logs = signal<WorkoutLog[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly failed = signal(false);

  readonly skeletonRows = [1, 2, 3];

  private _clientId: string | null = null;

  readonly activePlans = computed(() =>
    this.assignments().filter((a) => a.status === 'ACTIVE' || a.status === 'PENDING'),
  );

  readonly isEmpty = computed(
    () => this.loaded() && !this.activePlans().length && !this.logs().length,
  );

  constructor() {
    addIcons(PROGRAM_ICONS);
  }

  ionViewWillEnter(): void {
    const parts = this._router.url.split('?')[0].split('/');
    const id = parts[parts.indexOf('client') + 1] ?? null;
    if (!id) return;
    this._clientId = id;
    this.load();
  }

  load(): void {
    const clientId = this._clientId;
    if (!clientId) return;
    this.loading.set(true);
    this.failed.set(false);

    forkJoin({
      assignments: this._assignmentService
        .listForInstructor({ clientId, limit: 50 })
        .pipe(catchError(() => of(null))),
      logs: this._logService
        .listForClient(clientId, { limit: 25 })
        .pipe(catchError(() => of(null))),
    })
      .pipe(take(1))
      .subscribe(({ assignments, logs }) => {
        if (assignments) this.assignments.set(assignments.items);
        if (logs) this.logs.set(logs.items);
        this.failed.set(!assignments && !logs);
        this.loaded.set(true);
        this.loading.set(false);
      });
  }

  planPosition(plan: ProgramAssignment): string {
    return `${plan.completionPercent ?? 0}% done · started ${plan.startDate}`;
  }

  logDay(log: WorkoutLog): string {
    return dayDividerLabel(localDayKey(new Date(log.startedAt)));
  }

  logMeta(log: WorkoutLog): string {
    const parts: string[] = [];
    const duration = workoutDurationOf(log.durationSeconds);
    if (duration) parts.push(duration);
    if (log.feelingRating) parts.push(`felt ${log.feelingRating}/5`);
    return parts.join(' · ');
  }

  openLog(log: WorkoutLog): void {
    void this._router.navigate(['/tabs/clients/log', log.id]);
  }
}
