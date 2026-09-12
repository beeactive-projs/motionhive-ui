import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonFab,
  IonFabButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import {
  Program,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramService,
  displayName,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { AssignRequest, AssignSheet } from '../_sheets/assign-sheet/assign-sheet';
import { assignmentChip, assignmentTone, PROGRAM_ICONS } from '../programs.config';

/**
 * Who is on this program, in all five states.
 *
 * ACTIVE carries no chip on purpose: it is what most rows are, and a chip on
 * every row is a chip that says nothing. Only the exceptions speak.
 */
@Component({
  selector: 'mh-assignments',
  imports: [
    AssignSheet,
    EmptyState,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './assignments.html',
  styleUrl: './assignments.scss',
})
export class Assignments implements ViewWillEnter {
  private readonly _assignmentService = inject(ProgramAssignmentService);
  private readonly _programService = inject(ProgramService);
  private readonly _router = inject(Router);
  private readonly _feedback = inject(FeedbackService);

  readonly rows = signal<ProgramAssignment[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly failed = signal(false);
  readonly busy = signal<string | null>(null);
  readonly program = signal<Program | null>(null);
  readonly assignOpen = signal(false);

  readonly skeletonRows = [1, 2, 3];

  private _programId: string | null = null;

  readonly isEmpty = computed(() => this.loaded() && this.rows().length === 0);

  constructor() {
    addIcons(PROGRAM_ICONS);
  }

  ionViewWillEnter(): void {
    const parts = this._router.url.split('?')[0].split('/');
    const id = parts[parts.indexOf('program') + 1] ?? null;
    if (!id) return;
    this._programId = id;
    this.load();

    // The assign sheet previews the schedule, which needs the day grid.
    this._programService
      .get(id)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((program) => this.program.set(program));
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this._assignmentService
      .listForInstructor({ limit: 100 })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          // The endpoint spans every program this coach runs; this screen is
          // about one of them.
          this.rows.set(
            page.items.filter((a) => a.masterProgramId === this._programId),
          );
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loaded.set(true);
          this.loading.set(false);
        },
      });
  }

  openAssign(): void {
    this.assignOpen.set(true);
  }

  onAssign(request: AssignRequest): void {
    const programId = this._programId;
    if (!programId) return;

    this._assignmentService
      .assign({ programId, ...request })
      .pipe(take(1))
      .subscribe({
        next: () => {
          // Re-read rather than prepend the response: the create payload
          // carries no eager-loaded client, so an optimistic row would sit
          // there calling them "Client" until the next visit.
          this.load();
          void this._feedback.success('Program assigned');
        },
        error: (err) => void this._feedback.error(err, 'Could not assign the program'),
      });
  }

  clientName(row: ProgramAssignment): string {
    return displayName(row.client ?? null, 'Client');
  }

  chip(row: ProgramAssignment): { label: string; tone: string } | null {
    return assignmentChip(row.status);
  }

  tone(row: ProgramAssignment): string {
    return assignmentTone(row.status);
  }

  /** Paused rows say what resume does, because the answer is not obvious. */
  subline(row: ProgramAssignment): string {
    if (row.status === 'PAUSED') {
      return 'Paused — resuming shifts the remaining schedule forward';
    }
    if (row.status === 'PENDING') return `Starts ${row.startDate}`;
    if (row.status === 'ACTIVE') return `${row.completionPercent ?? 0}% done`;
    return '';
  }

  canPause(row: ProgramAssignment): boolean {
    return row.status === 'ACTIVE';
  }

  canResume(row: ProgramAssignment): boolean {
    return row.status === 'PAUSED';
  }

  setStatus(row: ProgramAssignment, status: 'ACTIVE' | 'PAUSED'): void {
    if (this.busy()) return;
    this.busy.set(row.id);
    this._assignmentService
      .update(row.id, { status })
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((updated) => {
        this.busy.set(null);
        if (!updated) {
          void this._feedback.info('Could not change that assignment');
          return;
        }
        // The update payload carries no eager-loaded client, so keep the one
        // already on screen — otherwise pausing renames the person "Client".
        this.rows.update((rows) =>
          rows.map((r) => (r.id === row.id ? { ...updated, client: r.client } : r)),
        );
      });
  }
}
