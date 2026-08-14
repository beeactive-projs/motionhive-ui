import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  ClientService,
  ClientStatusLabels,
  InitiatedByOptions,
  InstructorClient,
  InstructorClientStatuses,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  SessionInstance,
  SessionService,
  TagSeverity,
  WorkoutLog,
  WorkoutLogService,
  showApiError,
} from 'core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';
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
    ButtonDirective,
    Card,
    FormsModule,
    InputText,
    SelectButton,
    Skeleton,
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
  private readonly _route = inject(ActivatedRoute);
  private readonly _clientService = inject(ClientService);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _assignmentService = inject(ProgramAssignmentService);
  private readonly _sessionService = inject(SessionService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly Statuses = InstructorClientStatuses;
  readonly InitiatedBy = InitiatedByOptions;

  readonly client = signal<InstructorClient | null>(null);
  readonly loading = signal(true);
  readonly activeTab = signal(0);
  readonly showNotesDialog = signal(false);

  readonly tabs = [
    { label: 'Overview', value: 0, icon: 'pi pi-home' },
    { label: 'Sessions', value: 1, icon: 'pi pi-calendar' },
    { label: 'Programs', value: 4, icon: 'pi pi-bookmark' },
    { label: 'Workouts', value: 3, icon: 'pi pi-bolt' },
    { label: 'Progress', value: 2, icon: 'pi pi-chart-line' },
  ];

  // ── Workouts tab state ───────────────────────────────────────────
  readonly workouts = signal<WorkoutLog[]>([]);
  readonly workoutsLoading = signal(false);
  readonly workoutsLoaded = signal(false);
  readonly workoutsTotal = signal(0);
  readonly workoutsPage = signal(1);
  readonly workoutsHasMore = computed(
    () => this.workouts().length < this.workoutsTotal(),
  );

  /**
   * One page per tab. These lists were fetched as a single fixed slab
   * (100 sessions, 50 plans, 50 workouts) and rendered whole, so a busy
   * client silently lost everything past the cap — no count, no way to
   * reach it. Each tab now pages, reports its total, and defaults to
   * the slice that answers the question you opened the tab with.
   */
  static readonly PAGE = 15;

  // ── Sessions tab state ───────────────────────────────────────────
  readonly sessions = signal<SessionInstance[]>([]);
  readonly sessionsLoading = signal(false);
  readonly sessionsLoaded = signal(false);
  readonly sessionsTotal = signal(0);
  readonly sessionsPage = signal(1);
  readonly sessionsScope = signal<'upcoming' | 'past'>('upcoming');
  readonly sessionsHasMore = computed(
    () => this.sessions().length < this.sessionsTotal(),
  );
  readonly sessionScopes = [
    { label: 'Upcoming', value: 'upcoming' as const },
    { label: 'Past', value: 'past' as const },
  ];

  // ── Plans tab state ──────────────────────────────────────────────
  readonly assignments = signal<ProgramAssignment[]>([]);
  readonly assignmentsLoading = signal(false);
  readonly assignmentsLoaded = signal(false);
  readonly assignmentsTotal = signal(0);
  readonly assignmentsPage = signal(1);
  readonly assignmentsSearch = signal('');
  readonly assignmentsScope = signal<'current' | 'history' | 'all'>('current');
  readonly assignmentsHasMore = computed(
    () => this.assignments().length < this.assignmentsTotal(),
  );
  /**
   * "Current" is the default because a coach opens this to see what the
   * client is on now; finished plans pile up and bury it. There is no
   * single server-side status for "current", so it fetches PENDING,
   * ACTIVE and PAUSED and merges — hence the multi-request branch in
   * the loader. Current + History must cover every status between them.
   */
  readonly assignmentScopes = [
    { label: 'Current', value: 'current' as const },
    { label: 'History', value: 'history' as const },
    { label: 'All', value: 'all' as const },
  ];
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
    this._loadClient();

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
    // Sessions this client is booked into — loaded the first time the
    // tab is opened, like the others.
    effect(() => {
      if (
        this.activeTab() === 1 &&
        !this.sessionsLoaded() &&
        !this.sessionsLoading() &&
        this.client()
      ) {
        this._loadSessions();
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

  /**
   * The URL is the source of truth. This page used to read the client
   * out of router navigation state, which meant a refresh, a bookmark,
   * or a link from anywhere but the list landed on "not found" — and
   * nothing in the app ever passed that state, so it never worked.
   */
  private _loadClient(): void {
    const clientId = this._route.snapshot.paramMap.get('id');
    if (!clientId) {
      this.loading.set(false);
      return;
    }

    this._clientService.getClient(clientId).subscribe({
      next: (c) => {
        this.client.set(c);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        // 404 is the honest answer for "not your client" and already
        // has a panel; anything else is a fault worth surfacing.
        if (err.status !== 404) {
          showApiError(
            this._messageService,
            "Couldn't load this client",
            'Please try again.',
            err,
          );
        }
      },
    });
  }

  /**
   * Sessions, one page at a time, split by whether they have happened.
   *
   * "Upcoming" reads forward from now and sorts ascending (the next one
   * first); "Past" reads backward and sorts descending (the most recent
   * first). Both are what you actually want to see at the top, and they
   * are different orders — so the sort follows the scope rather than
   * being fixed.
   *
   * The window is 89 days rather than 90 because the server rejects a
   * span *greater than* 180 days, and two `Date`s built microseconds
   * apart put 90+90 a hair over it.
   */
  private _loadSessions(append = false): void {
    const c = this.client();
    if (!c?.clientId) return;

    const DAYS = 89;
    const now = Date.now();
    const upcoming = this.sessionsScope() === 'upcoming';
    const page = append ? this.sessionsPage() + 1 : 1;

    this.sessionsLoading.set(true);
    this._sessionService
      .listInstances({
        clientId: c.clientId,
        dateFrom: new Date(upcoming ? now : now - DAYS * 86_400_000).toISOString(),
        dateTo: new Date(upcoming ? now + DAYS * 86_400_000 : now).toISOString(),
        page,
        limit: ClientProfile.PAGE,
      })
      .subscribe({
        next: (res) => {
          const sorted = [...res.items].sort((a, b) =>
            upcoming
              ? a.startAt.localeCompare(b.startAt)
              : b.startAt.localeCompare(a.startAt),
          );
          this.sessions.update((cur) => (append ? [...cur, ...sorted] : sorted));
          this.sessionsTotal.set(res.total);
          this.sessionsPage.set(page);
          this.sessionsLoaded.set(true);
          this.sessionsLoading.set(false);
        },
        error: (err) => {
          this.sessionsLoading.set(false);
          this.sessionsLoaded.set(true);
          showApiError(
            this._messageService,
            "Couldn't load sessions",
            'Please retry in a moment.',
            err,
          );
        },
      });
  }

  setSessionScope(scope: 'upcoming' | 'past'): void {
    if (scope === this.sessionsScope()) return;
    this.sessionsScope.set(scope);
    this._loadSessions();
  }

  loadMoreSessions(): void {
    if (this.sessionsLoading()) return;
    this._loadSessions(true);
  }

  sessionTitle(s: SessionInstance): string {
    return s.titleOverride ?? s.template?.title ?? 'Session';
  }

  sessionVenue(s: SessionInstance): string | null {
    return s.venueOverride?.name ?? s.template?.venue?.name ?? null;
  }

  /** This client's own booking status, not the session's headcount. */
  private _participantStatus(s: SessionInstance): string | null {
    const clientId = this.client()?.clientId;
    if (!clientId) return null;
    return (
      s.participants?.find((p) => p.userId === clientId)?.status ?? null
    );
  }

  participantLabel(s: SessionInstance): string {
    if (s.status === 'CANCELLED') return 'Session cancelled';
    switch (this._participantStatus(s)) {
      case 'CONFIRMED':
        return 'Booked';
      case 'PENDING_APPROVAL':
        return 'Awaiting approval';
      case 'WAITLISTED':
        return 'Waitlisted';
      default:
        return 'Booked';
    }
  }

  participantSeverity(s: SessionInstance): TagSeverity {
    if (s.status === 'CANCELLED') return TagSeverity.Danger;
    switch (this._participantStatus(s)) {
      case 'PENDING_APPROVAL':
        return TagSeverity.Warn;
      case 'WAITLISTED':
        return TagSeverity.Secondary;
      default:
        return TagSeverity.Success;
    }
  }

  openSession(s: SessionInstance): void {
    void this._router.navigate(['/coaching/sessions', s.id, 'attendance']);
  }

  /**
   * Plans, one page at a time.
   *
   * "Current" has no single server-side status, so it fires one request
   * per live status and merges. That makes its `total` the sum of both
   * counts, which is right for "how many are live" but means paging is
   * per-status — acceptable because a client rarely has more than a
   * handful of live plans. History and All are a single request.
   */
  private _loadAssignments(append = false): void {
    const c = this.client();
    if (!c?.clientId) return;

    const page = append ? this.assignmentsPage() + 1 : 1;
    const scope = this.assignmentsScope();
    const base = {
      clientId: c.clientId,
      search: this.assignmentsSearch().trim() || undefined,
      page,
      limit: ClientProfile.PAGE,
    };

    // Every status must land in exactly one scope, or plans go missing
    // from both lenses: PENDING (assigned, not started yet) is upcoming
    // work, so it belongs with Current, not History.
    const statuses: (ProgramAssignmentStatus | undefined)[] =
      scope === 'current'
        ? ['PENDING', 'ACTIVE', 'PAUSED']
        : scope === 'history'
          ? ['COMPLETED', 'CANCELLED']
          : [undefined];

    this.assignmentsLoading.set(true);
    forkJoin(
      statuses.map((status) =>
        this._assignmentService.listForInstructor({ ...base, status }),
      ),
    ).subscribe({
      next: (pages) => {
        const items = pages
          .flatMap((r) => r.items)
          .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
        this.assignments.update((cur) => (append ? [...cur, ...items] : items));
        this.assignmentsTotal.set(pages.reduce((n, r) => n + r.total, 0));
        this.assignmentsPage.set(page);
        this.assignmentsLoaded.set(true);
        this.assignmentsLoading.set(false);
      },
      error: (err) => {
        this.assignmentsLoading.set(false);
        this.assignmentsLoaded.set(true);
        showApiError(
          this._messageService,
          "Couldn't load programs",
          'Please retry in a moment.',
          err,
        );
      },
    });
  }

  setAssignmentScope(scope: 'current' | 'history' | 'all'): void {
    if (scope === this.assignmentsScope()) return;
    this.assignmentsScope.set(scope);
    this._loadAssignments();
  }

  /** Debounced by the template's 300ms input, so this just refetches. */
  onAssignmentSearch(term: string): void {
    this.assignmentsSearch.set(term);
    this._loadAssignments();
  }

  loadMoreAssignments(): void {
    if (this.assignmentsLoading()) return;
    this._loadAssignments(true);
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
      header: 'Cancel this program?',
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

  private _loadWorkouts(append = false): void {
    const c = this.client();
    if (!c?.clientId) return;
    const page = append ? this.workoutsPage() + 1 : 1;
    this.workoutsLoading.set(true);
    this._workoutLogService
      .listForClient(c.clientId, { page, limit: ClientProfile.PAGE })
      .subscribe({
      next: (res) => {
        this.workouts.update((cur) => (append ? [...cur, ...res.items] : res.items));
        this.workoutsTotal.set(res.total);
        this.workoutsPage.set(page);
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

  loadMoreWorkouts(): void {
    if (this.workoutsLoading()) return;
    this._loadWorkouts(true);
  }

  openWorkoutReplay(log: WorkoutLog): void {
    this._router.navigate(['/user/workout-log', log.id, 'replay'], {
      queryParams: { coach: 1 },
    });
  }

  /**
   * A plan can be assigned with a start date in the future. Saying
   * "Started 26 Aug" three weeks early reads as a plan the client is
   * already behind on.
   */
  hasStarted(a: ProgramAssignment): boolean {
    return !a.startDate || new Date(a.startDate).getTime() <= Date.now();
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

  /** Same entry point as the roster card — opens or starts the DM. */
  messageClient(): void {
    const c = this.client();
    if (!c?.clientId) return;
    void this._router.navigate(['/messages'], {
      queryParams: { to: c.clientId },
    });
  }

  onNotesSaved(): void {
    // Was a no-op waiting on a single-client endpoint that didn't exist,
    // so a saved note stayed stale until a manual refresh.
    this._loadClient();
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
      rejectButtonProps: { severity: 'secondary', text: true },
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
