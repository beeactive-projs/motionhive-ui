import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import {
  ClientService,
  ClientStatusLabels,
  EnumLabelPipe,
  InitiatedByOptions,
  InstructorClient,
  InstructorClientStatuses,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  SESSION_PARTICIPANT_STATUSES,
  SessionInstance,
  SessionInstanceStatus,
  SessionParticipantStatus,
  SessionService,
  TagSeverity,
  WorkoutLog,
  WorkoutLogService,
  showApiError,
} from 'core';
import { ConfirmationService, MessageService, SelectItem } from 'primeng/api';
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
    EnumLabelPipe,
    TranslatePipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './client-profile.html',
  styleUrl: './client-profile.scss',
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
  private readonly _translateService = inject(TranslateService);

  readonly Statuses = InstructorClientStatuses;
  readonly InitiatedBy = InitiatedByOptions;

  readonly client = signal<InstructorClient | null>(null);
  readonly loading = signal(true);
  readonly activeTab = signal(0);
  readonly showNotesDialog = signal(false);

  /** Labels are translation keys — the template translates them. */
  readonly tabs = [
    { label: 'clients.profile.tabs.overview', value: 0, icon: 'pi pi-home' },
    { label: 'clients.profile.tabs.sessions', value: 1, icon: 'pi pi-calendar' },
    { label: 'clients.profile.tabs.programs', value: 4, icon: 'pi pi-bookmark' },
    { label: 'clients.profile.tabs.workouts', value: 3, icon: 'pi pi-bolt' },
    { label: 'clients.profile.tabs.progress', value: 2, icon: 'pi pi-chart-line' },
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
  readonly sessionScopes: SelectItem<'upcoming' | 'past'>[] = [
    { label: this._translateService.instant('clients.profile.sessions.scope.upcoming'), value: 'upcoming' },
    { label: this._translateService.instant('clients.profile.sessions.scope.past'), value: 'past' },
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
  readonly assignmentScopes: SelectItem<'current' | 'history' | 'all'>[] = [
    { label: this._translateService.instant('clients.profile.programs.scope.current'), value: 'current' },
    { label: this._translateService.instant('clients.profile.programs.scope.history'), value: 'history' },
    { label: this._translateService.instant('common.all'), value: 'all' },
  ];
  /** id of the assignment whose status is being mutated — drives per-row spinner. */
  readonly assignmentMutatingId = signal<string | null>(null);

  /**
   * Debounces the Programs-tab search. Every keystroke used to fan out
   * as a fresh forkJoin over `['PENDING','ACTIVE','PAUSED']` — three
   * parallel requests per character — and a typed-fast search would
   * blow past the global rate limit and pop the "Something Went Wrong"
   * modal. Now the input pushes into a Subject and only the last value
   * in a 300ms window fires the load.
   */
  private readonly _searchInput = new Subject<string>();

  readonly clientName = computed(() => {
    const c = this.client();
    if (!c) return '';
    if (c.client) return `${c.client.firstName} ${c.client.lastName}`;
    return c.invitedEmail ?? this._translateService.instant('common.unknown');
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

  /** Top 3 workouts for the Overview "Recent workouts" card. */
  readonly recentWorkouts = computed(() => this.workouts().slice(0, 3));

  /**
   * Active assignments for the Overview "Programs" card. Reads from the
   * same signal the Plans tab writes into; if the coach flipped that tab
   * to History it'll temporarily hold no active rows, but the Overview
   * still renders correctly — it just shows the empty state until the
   * Plans tab is switched back or the Overview reload picks up.
   */
  readonly AssignmentStatus = ProgramAssignmentStatus;

  readonly activeAssignments = computed(() =>
    this.assignments().filter((a) =>
      a.status === ProgramAssignmentStatus.Pending || a.status === ProgramAssignmentStatus.Active || a.status === ProgramAssignmentStatus.Paused,
    ),
  );

  /** Number of workouts this client has logged in the last 7 days. */
  readonly workoutsLast7Days = computed(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.workouts().filter((w) => {
      const t = w.startedAt ? new Date(w.startedAt).getTime() : 0;
      return t >= cutoff;
    }).length;
  });

  readonly statusLabel = computed(() => {
    const c = this.client();
    if (!c) return '';
    return ClientStatusLabels[c.status];
  });

  readonly statusSeverity = computed((): TagSeverity => {
    switch (this.client()?.status) {
      case InstructorClientStatuses.Active:
        return TagSeverity.Success;
      case InstructorClientStatuses.Archived:
        return TagSeverity.Danger;
      case InstructorClientStatuses.Pending:
        return TagSeverity.Warn;
      default:
        return TagSeverity.Secondary;
    }
  });

  constructor() {
    this._loadClient();

    // Overview (tab 0) surfaces summary cards for recent workouts and
    // active programs, so it needs the same data the Workouts (3) and
    // Plans (4) tabs load. Piggybacking on the existing signals means
    // switching to those tabs afterwards is instant, and the Overview
    // stays live if the client completes something while it's open.
    // Sessions tab (1) still has its own load — the Overview doesn't
    // surface bookings, and pre-fetching them would be wasted round-
    // trips for every coach who never opens that tab.
    effect(() => {
      const tab = this.activeTab();
      if (
        (tab === 3 || tab === 0) &&
        !this.workoutsLoaded() &&
        !this.workoutsLoading() &&
        this.client()
      ) {
        this._loadWorkouts();
      }
    });
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
    effect(() => {
      const tab = this.activeTab();
      if (
        (tab === 4 || tab === 0) &&
        !this.assignmentsLoaded() &&
        !this.assignmentsLoading() &&
        this.client()
      ) {
        this._loadAssignments();
      }
    });

    // Debounced Programs-tab search — see `_searchInput` for context.
    this._searchInput
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((term) => {
        this.assignmentsSearch.set(term);
        this._loadAssignments();
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
            this._translateService.instant('clients.toast.loadClientFailed'),
            this._translateService.instant('common.pleaseTryAgain'),
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
            this._translateService.instant('clients.toast.loadSessionsFailed'),
            this._translateService.instant('clients.common.retryInAMoment'),
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
    return s.titleOverride ?? s.template?.title ?? this._translateService.instant('common.session');
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

  /** Core's status words/tones; a cancelled *session* outranks the booking. */
  participantLabel(s: SessionInstance): string {
    if (s.status === SessionInstanceStatus.Cancelled) {
      return this._translateService.instant('clients.profile.sessions.cancelled');
    }
    const status = this._participantStatus(s);
    return (
      (status &&
        SESSION_PARTICIPANT_STATUSES[status as SessionParticipantStatus]?.label) ||
      this._translateService.instant('clients.profile.sessions.booked')
    );
  }

  participantSeverity(s: SessionInstance): TagSeverity {
    if (s.status === SessionInstanceStatus.Cancelled) return TagSeverity.Danger;
    const status = this._participantStatus(s);
    return (
      (status &&
        SESSION_PARTICIPANT_STATUSES[status as SessionParticipantStatus]?.tone) ||
      TagSeverity.Success
    );
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
        ? [ProgramAssignmentStatus.Pending, ProgramAssignmentStatus.Active, ProgramAssignmentStatus.Paused]
        : scope === 'history'
          ? [ProgramAssignmentStatus.Completed, ProgramAssignmentStatus.Cancelled]
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
          this._translateService.instant('clients.toast.loadProgramsFailed'),
          this._translateService.instant('clients.common.retryInAMoment'),
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

  /**
   * Debounced through `_searchInput`. Every keystroke fans out into a
   * `forkJoin` of three status requests in "Current" scope, so hitting
   * the endpoint per character trips the throttle quickly.
   */
  onAssignmentSearch(term: string): void {
    this._searchInput.next(term);
  }

  loadMoreAssignments(): void {
    if (this.assignmentsLoading()) return;
    this._loadAssignments(true);
  }

  // ── Plans tab — actions ──────────────────────────────────────────

  pauseAssignment(a: ProgramAssignment): void {
    this._mutateStatus(a, ProgramAssignmentStatus.Paused, 'paused', 'pauseFailed');
  }

  resumeAssignment(a: ProgramAssignment): void {
    this._mutateStatus(a, ProgramAssignmentStatus.Active, 'resumed', 'resumeFailed');
  }

  confirmCancelAssignment(a: ProgramAssignment): void {
    this._confirmationService.confirm({
      header: this._translateService.instant('clients.confirm.cancelProgram.header'),
      message: this._translateService.instant('clients.confirm.cancelProgram.message', {
        program: a.programNameSnapshot,
        name: this.clientName(),
      }),
      icon: 'pi pi-times-circle',
      acceptLabel: this._translateService.instant('clients.confirm.cancelProgram.accept'),
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: this._translateService.instant('button.keep'),
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._mutateStatus(a, ProgramAssignmentStatus.Cancelled, 'cancelled', 'cancelFailed'),
    });
  }

  isAssignmentTerminal(a: ProgramAssignment): boolean {
    return a.status === ProgramAssignmentStatus.Completed || a.status === ProgramAssignmentStatus.Cancelled;
  }

  assignmentStatusSeverity(a: ProgramAssignment): TagSeverity {
    switch (a.status) {
      case ProgramAssignmentStatus.Active:
        return TagSeverity.Success;
      case ProgramAssignmentStatus.Paused:
        return TagSeverity.Warn;
      case ProgramAssignmentStatus.Completed:
        return TagSeverity.Info;
      case ProgramAssignmentStatus.Cancelled:
        return TagSeverity.Danger;
      default:
        return TagSeverity.Secondary;
    }
  }

  /**
   * `doneKey` / `failedKey` name the `clients.toast.plan.*` messages for
   * this transition — one full sentence each, never a spliced verb.
   */
  private _mutateStatus(
    a: ProgramAssignment,
    next: ProgramAssignmentStatus,
    doneKey: 'paused' | 'resumed' | 'cancelled',
    failedKey: 'pauseFailed' | 'resumeFailed' | 'cancelFailed',
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
          summary: this._translateService.instant(`clients.toast.plan.${doneKey}`),
          life: 2000,
        });
      },
      error: (err) => {
        this.assignmentMutatingId.set(null);
        showApiError(
          this._messageService,
          this._translateService.instant(`clients.toast.plan.${failedKey}`),
          this._translateService.instant('clients.common.retryInAMoment'),
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
          this._translateService.instant('clients.toast.loadWorkoutsFailed.summary'),
          this._translateService.instant('clients.toast.loadWorkoutsFailed.detail'),
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
      message: this._translateService.instant('clients.confirm.archive.message', {
        name: this.clientName(),
      }),
      header: this._translateService.instant('clients.confirm.archive.header'),
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
          summary: this._translateService.instant('clients.toast.archived.summary'),
          detail: this._translateService.instant('clients.toast.archived.detail'),
        });
        this.client.update((prev) =>
          prev ? { ...prev, status: InstructorClientStatuses.Archived } : prev,
        );
      },
      error: (err) =>
        showApiError(
          this._messageService,
          this._translateService.instant('clients.toast.archiveFailed.summary'),
          this._translateService.instant('clients.toast.archiveFailed.detail'),
          err,
        ),
    });
  }

  confirmUnarchive(): void {
    this._confirmationService.confirm({
      message: this._translateService.instant('clients.confirm.unarchive.message', {
        name: this.clientName(),
      }),
      header: this._translateService.instant('clients.confirm.unarchive.header'),
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
          summary: this._translateService.instant('clients.toast.unarchived.summary'),
          detail: this._translateService.instant('clients.toast.unarchived.detail'),
        });
        this.client.update((prev) =>
          prev ? { ...prev, status: InstructorClientStatuses.Active } : prev,
        );
      },
      error: (err) =>
        showApiError(
          this._messageService,
          this._translateService.instant('clients.toast.unarchiveFailed.summary'),
          this._translateService.instant('clients.toast.unarchiveFailed.detail'),
          err,
        ),
    });
  }
}
