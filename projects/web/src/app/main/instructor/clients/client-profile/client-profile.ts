import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  ClientService,
  ClientStatusLabels,
  InitiatedByOptions,
  InstructorClient,
  InstructorClientStatuses,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  TagSeverity,
  WorkoutLog,
  WorkoutLogService,
  showApiError,
} from 'core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { EditClientNotesDialog } from '../../_dialogs/edit-client-notes-dialog/edit-client-notes-dialog';
import { Avatar } from '../../../../_shared/components/avatar/avatar';

@Component({
  selector: 'mh-client-profile',
  imports: [
    DatePipe,
    Avatar,
    Button,
    Card,
    Tag,
    Toast,
    ConfirmDialog,
    TooltipModule,
    EditClientNotesDialog,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './client-profile.html',
  styleUrl: './client-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientProfile {
  private readonly _router = inject(Router);
  private readonly _clientService = inject(ClientService);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _assignmentService = inject(ProgramAssignmentService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly Statuses = InstructorClientStatuses;
  readonly InitiatedBy = InitiatedByOptions;

  readonly client = signal<InstructorClient | null>(null);
  readonly activeTab = signal(0);
  readonly showNotesDialog = signal(false);

  readonly tabs = [
    { label: 'Overview', value: 0, icon: 'pi pi-home' },
    { label: 'Sessions', value: 1, icon: 'pi pi-calendar' },
    { label: 'Plans', value: 4, icon: 'pi pi-bookmark' },
    { label: 'Workouts', value: 3, icon: 'pi pi-bolt' },
    { label: 'Progress', value: 2, icon: 'pi pi-chart-line' },
  ];

  // ── Workouts tab state ───────────────────────────────────────────
  readonly workouts = signal<WorkoutLog[]>([]);
  readonly workoutsLoading = signal(false);
  readonly workoutsLoaded = signal(false);

  // ── Plans tab state ──────────────────────────────────────────────
  readonly assignments = signal<ProgramAssignment[]>([]);
  readonly assignmentsLoading = signal(false);
  readonly assignmentsLoaded = signal(false);
  /** id of the assignment whose status is being mutated — drives per-row spinner. */
  readonly assignmentMutatingId = signal<string | null>(null);

  readonly clientName = computed(() => {
    const c = this.client();
    if (!c) return '';
    if (c.client) return `${c.client.firstName} ${c.client.lastName}`;
    return c.invitedEmail ?? 'Unknown';
  });

  readonly clientEmail = computed(() => {
    const c = this.client();
    return c?.client?.email ?? c?.invitedEmail ?? '—';
  });

  readonly initials = computed(() => {
    const c = this.client();
    if (!c) return '?';
    if (c.client) return c.client.firstName.charAt(0) + c.client.lastName.charAt(0);
    return c.invitedEmail?.charAt(0).toUpperCase() ?? '?';
  });

  readonly statusLabel = computed(() => {
    const c = this.client();
    if (!c) return '';
    return ClientStatusLabels[c.status];
  });

  readonly statusSeverity = computed((): TagSeverity => {
    switch (this.client()?.status) {
      case 'ACTIVE':
        return TagSeverity.Success;
      case 'ARCHIVED':
        return TagSeverity.Danger;
      case 'PENDING':
        return TagSeverity.Warn;
      default:
        return TagSeverity.Secondary;
    }
  });

  constructor() {
    const nav = this._router.getCurrentNavigation();
    const state = nav?.extras?.state as { client?: InstructorClient } | undefined;
    if (state?.client) {
      this.client.set(state.client);
    } else {
      const histState = window.history.state as { client?: InstructorClient };
      if (histState?.client) {
        this.client.set(histState.client);
      }
    }
    // Lazy-load the client's workout history the first time the
    // Workouts tab is opened. BE 404s if the link isn't ACTIVE, so
    // archived/pending links surface as "No workouts" with a toast.
    effect(() => {
      if (
        this.activeTab() === 3 &&
        !this.workoutsLoaded() &&
        !this.workoutsLoading() &&
        this.client()
      ) {
        this._loadWorkouts();
      }
    });
    // Lazy-load program assignments the first time the Plans tab is
    // opened. The instructor list endpoint already filters by clientId.
    effect(() => {
      if (
        this.activeTab() === 4 &&
        !this.assignmentsLoaded() &&
        !this.assignmentsLoading() &&
        this.client()
      ) {
        this._loadAssignments();
      }
    });
  }

  private _loadAssignments(): void {
    const c = this.client();
    if (!c) return;
    this.assignmentsLoading.set(true);
    this._assignmentService
      .listForInstructor({ clientId: c.clientId, limit: 50 })
      .subscribe({
        next: (res) => {
          this.assignments.set(res.items);
          this.assignmentsLoaded.set(true);
          this.assignmentsLoading.set(false);
        },
        error: (err) => {
          this.assignmentsLoading.set(false);
          this.assignmentsLoaded.set(true);
          showApiError(
            this._messageService,
            "Couldn't load plans",
            'Please retry in a moment.',
            err,
          );
        },
      });
  }

  // ── Plans tab — actions ──────────────────────────────────────────

  pauseAssignment(a: ProgramAssignment): void {
    this._mutateStatus(a, 'PAUSED', 'paused');
  }

  resumeAssignment(a: ProgramAssignment): void {
    this._mutateStatus(a, 'ACTIVE', 'resumed');
  }

  confirmCancelAssignment(a: ProgramAssignment): void {
    this._confirmationService.confirm({
      header: 'Cancel this plan?',
      message: `Cancel "${a.programNameSnapshot}" for ${this.clientName()}? Already-logged workouts stay in history, but no further sessions will be scheduled.`,
      icon: 'pi pi-times-circle',
      acceptLabel: 'Cancel plan',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Keep',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._mutateStatus(a, 'CANCELLED', 'cancelled'),
    });
  }

  isAssignmentTerminal(a: ProgramAssignment): boolean {
    return a.status === 'COMPLETED' || a.status === 'CANCELLED';
  }

  assignmentStatusSeverity(a: ProgramAssignment): TagSeverity {
    switch (a.status) {
      case 'ACTIVE':
        return TagSeverity.Success;
      case 'PAUSED':
        return TagSeverity.Warn;
      case 'COMPLETED':
        return TagSeverity.Info;
      case 'CANCELLED':
        return TagSeverity.Danger;
      default:
        return TagSeverity.Secondary;
    }
  }

  private _mutateStatus(
    a: ProgramAssignment,
    next: ProgramAssignmentStatus,
    verbPast: string,
  ): void {
    if (this.assignmentMutatingId() || this.isAssignmentTerminal(a)) return;
    this.assignmentMutatingId.set(a.id);
    this._assignmentService.update(a.id, { status: next }).subscribe({
      next: (updated) => {
        this.assignmentMutatingId.set(null);
        this.assignments.update((cur) =>
          cur.map((x) =>
            x.id === a.id ? { ...x, status: updated.status } : x,
          ),
        );
        this._messageService.add({
          severity: 'success',
          summary: `Plan ${verbPast}`,
          life: 2000,
        });
      },
      error: (err) => {
        this.assignmentMutatingId.set(null);
        showApiError(
          this._messageService,
          `Couldn't ${verbPast.replace(/d$/, '')} plan`,
          'Please retry in a moment.',
          err,
        );
      },
    });
  }

  private _loadWorkouts(): void {
    const c = this.client();
    if (!c) return;
    this.workoutsLoading.set(true);
    this._workoutLogService.listForClient(c.clientId, { limit: 50 }).subscribe({
      next: (res) => {
        this.workouts.set(res.items);
        this.workoutsLoaded.set(true);
        this.workoutsLoading.set(false);
      },
      error: (err) => {
        this.workoutsLoading.set(false);
        this.workoutsLoaded.set(true);
        showApiError(
          this._messageService,
          "Couldn't load workouts",
          'This client may not have logged any sessions yet.',
          err,
        );
      },
    });
  }

  openWorkoutReplay(log: WorkoutLog): void {
    this._router.navigate(['/user/workout-log', log.id, 'replay'], {
      queryParams: { coach: 1 },
    });
  }

  workoutSetCount(log: WorkoutLog): number {
    return (log.exercises ?? []).reduce(
      (n, e) => n + (e.sets ?? []).filter((s) => s.isCompleted).length,
      0,
    );
  }

  workoutDurationMin(log: WorkoutLog): number | null {
    return log.durationSeconds != null
      ? Math.round(log.durationSeconds / 60)
      : null;
  }

  goBack(): void {
    this._router.navigate(['/coaching/clients']);
  }

  openNotesDialog(): void {
    this.showNotesDialog.set(true);
  }

  onNotesSaved(): void {
    // Refresh from server once the individual-client endpoint is available
  }

  confirmArchive(): void {
    this._confirmationService.confirm({
      message: `Are you sure you want to archive ${this.clientName()}?`,
      header: 'Archive client',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doArchive(),
    });
  }

  private doArchive(): void {
    const c = this.client();
    if (!c) return;
    this._clientService.archiveClient(c.clientId).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Client archived',
          detail: 'Client relationship has been archived',
        });
        this.client.update((prev) =>
          prev ? { ...prev, status: InstructorClientStatuses.Archived } : prev,
        );
      },
      error: (err) =>
        showApiError(this._messageService, 'Archive failed', 'Failed to archive client', err),
    });
  }

  confirmUnarchive(): void {
    this._confirmationService.confirm({
      message: `Are you sure you want to unarchive ${this.clientName()}?`,
      header: 'Unarchive client',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: { text: 'true' },
      accept: () => this.doUnarchive(),
    });
  }

  private doUnarchive(): void {
    const c = this.client();
    if (!c) return;
    this._clientService.unarchiveClient(c.clientId).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Client unarchived',
          detail: 'Client relationship has been restored',
        });
        this.client.update((prev) =>
          prev ? { ...prev, status: InstructorClientStatuses.Active } : prev,
        );
      },
      error: (err) =>
        showApiError(this._messageService, 'Unarchive failed', 'Failed to unarchive client', err),
    });
  }
}
