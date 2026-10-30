import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import {
  InstructorClientStatuses,
  ProgramAssignment,
  ProgramAssignmentStatus,
  SessionInstance,
  WorkoutLog,
  WorkoutLogStatus,
  clientDisplayName,
  clientEmail,
  appLocale,
  formatSessionDuration,
  formatSessionTime,
  localDayKey,
  sessionDayLabel,
  sessionMinutes,
} from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { injectOpenDirectMessage } from '../../../_shared/utils/direct-message';
import { SessionMonth } from '../../coach/sessions/_components/session-month/session-month';
import { SessionRow } from '../../coach/sessions/_components/session-row/session-row';
import { instancePlaceLabel } from '../../coach/sessions/sessions.config';
import { assignmentSubline } from '../../programs/programs.config';
import { logMeta, logWeeks, shortDayLabel } from '../../workouts/workouts.config';
import { HistoryCalendar } from '../../workouts/_components/history-calendar/history-calendar';
import { LogRow } from '../../workouts/_components/log-row/log-row';
import { ProgressBody } from '../../workouts/_components/progress-body/progress-body';
import {
  AssignmentRow,
  AssignmentRowSubjects,
} from '../../programs/_components/assignment-row/assignment-row';
import { AssignRequest, AssignSheet } from '../../programs/_sheets/assign-sheet/assign-sheet';
import { ClientActionsSheet } from '../_sheets/client-actions-sheet/client-actions-sheet';
import { ClientNotesSheet } from '../_sheets/client-notes-sheet/client-notes-sheet';
import {
  ClientActionId,
  ClientActionIds,
  ClientTab,
  ClientTabs,
  clientTabFrom,
} from '../clients.config';
import { CLIENT_ICONS } from '../clients.icons';
import { coachStackOf } from '../client-paths';
import { adherenceLabel, attentionReason, lastActiveLabel } from '../roster-labels';
import {
  ClientDetailStore,
  PAST_DAYS,
  TrainingKind,
  TrainingKinds,
  UPCOMING_DAYS,
} from './client-detail.store';

/** Which way the Sessions section looks. */
const SessionScopes = {
  Upcoming: 'upcoming',
  Past: 'past',
} as const;
type SessionScope = (typeof SessionScopes)[keyof typeof SessionScopes];

/**
 * One client, in four tabs: Overview (who they are, how their week is going,
 * and one row each for the next session, the plan and the last workout),
 * Sessions either side of today, Training (plans and what they logged), and
 * Progress (the trainee's own numbers, read for this client). Only grounded
 * sections: the This week card exists only when the roster has this person,
 * a row only when there is one, so nothing on the screen is invented. A
 * pending invite has nothing to tab through and shows only who is awaited.
 *
 * Mounted under Clients and under Programs (from a plan's list of who is on
 * it); every link out stays in whichever stack it was opened in, so back
 * always returns here. See `client-paths.ts`. The address carries the tab
 * (`?tab=`): a link opens it, and switching tabs rewrites it in place, so a
 * refresh or a way back lands on the same one. The old training and progress
 * addresses land there too.
 *
 * The URL is the source of truth: a refresh, a deep link, or a tap from any
 * list all land here with the client's user id and load from it.
 */
@Component({
  selector: 'mh-client-detail',
  imports: [
    AssignmentRow,
    AssignSheet,
    ClientActionsSheet,
    ClientNotesSheet,
    ConfirmSheet,
    DatePipe,
    EmptyState,
    HexAvatar,
    HistoryCalendar,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonCard,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    LogRow,
    NgTemplateOutlet,
    ProgressBody,
    SessionMonth,
    SessionRow,
    TranslatePipe,
  ],
  templateUrl: './client-detail.html',
  styleUrl: './client-detail.scss',
  providers: [ClientDetailStore],
})
export class ClientDetail implements ViewWillEnter {
  readonly store = inject(ClientDetailStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _openDirectMessage = injectOpenDirectMessage();

  readonly Statuses = InstructorClientStatuses;
  readonly PlanStatuses = ProgramAssignmentStatus;
  readonly RowSubjects = AssignmentRowSubjects;
  readonly Scopes = SessionScopes;
  readonly Tabs = ClientTabs;
  readonly skeletonRows = [1, 2, 3];
  /** The Upcoming sessions window, named beside its kicker. */
  readonly upcomingDays = UPCOMING_DAYS;
  readonly pastDays = PAST_DAYS;

  /** Clients or Programs, whichever this page was opened from. */
  private readonly _stack = coachStackOf(this._router.url);
  /** Back on a cold load: the list this page belongs to. */
  readonly backHref: string = this._stack;

  readonly actionsOpen = signal(false);
  readonly notesOpen = signal(false);
  readonly notesSaving = signal(false);
  readonly archiveOpen = signal(false);
  readonly archiveSaving = signal(false);
  readonly assignOpen = signal(false);
  readonly assignSaving = signal(false);
  /** Past plans are a record; folded away until asked for. */
  readonly pastPlansOpen = signal(false);
  /** Null until the coach picks: the default follows what there is to show. */
  private readonly _sessionScope = signal<SessionScope | null>(null);

  /** The Sessions list's chips. */
  readonly sessionScopes: readonly { id: SessionScope; label: string }[] = [
    { id: SessionScopes.Upcoming, label: 'clients.detail.sessions.upcoming' },
    { id: SessionScopes.Past, label: 'clients.detail.sessions.past' },
  ];
  /** The Sessions calendar shows when asked for, from the button beside the chips. */
  readonly sessionCalendarOpen = signal(false);

  /** The Training list's chips, in the design's order. */
  readonly kinds: readonly { id: TrainingKind; label: string }[] = [
    { id: TrainingKinds.All, label: 'clients.detail.training.kinds.all' },
    { id: TrainingKinds.Plan, label: 'clients.detail.training.kinds.plan' },
    { id: TrainingKinds.Own, label: 'clients.detail.training.kinds.own' },
    { id: TrainingKinds.Skipped, label: 'clients.detail.training.kinds.skipped' },
  ];

  /** The Training calendar shows when asked for, from the button beside the chips. */
  readonly calendarOpen = signal(false);

  /** The tab the address names; Overview when it names none. */
  private readonly _tab = signal<ClientTab>(
    clientTabFrom(this._route.snapshot.queryParamMap.get('tab')),
  );
  /** A pending invite has only the Overview: nothing else exists yet. */
  readonly tab = computed<ClientTab>(() => (this.isPending() ? ClientTabs.Overview : this._tab()));
  readonly showTabs = computed(() => !!this.store.client() && !this.isPending());

  private readonly _progressBody = viewChild(ProgressBody);

  readonly name = computed(() => {
    const client = this.store.client();
    return client ? clientDisplayName(client) : '';
  });

  readonly email = computed(() => {
    const client = this.store.client();
    return client ? clientEmail(client) : '';
  });

  readonly avatarTone = computed(() => avatarToneFor(this.store.client()?.clientId));

  readonly avatarUrl = computed(() => this.store.client()?.client?.avatarUrl ?? null);

  readonly isActive = computed(
    () => this.store.client()?.status === InstructorClientStatuses.Active,
  );

  readonly isArchived = computed(
    () => this.store.client()?.status === InstructorClientStatuses.Archived,
  );

  readonly isPending = computed(
    () => this.store.client()?.status === InstructorClientStatuses.Pending,
  );

  readonly canMessage = computed(() => !!this.store.client()?.client);

  /** Their public handle: no account (an email invite) means no profile to open. */
  readonly handle = computed(() => this.store.client()?.client?.handle ?? null);

  /** Only an active relationship can be given work — the API says the same. */
  readonly canAssign = computed(() => this.isActive());

  /** Upcoming when anything is booked, otherwise what already happened. */
  readonly sessionScope = computed<SessionScope>(
    () =>
      this._sessionScope() ??
      (this.store.sessions().length || !this.store.pastSessions().length
        ? SessionScopes.Upcoming
        : SessionScopes.Past),
  );

  /** The first booked session, for the Overview's door into Sessions. */
  readonly nextSession = computed(() => {
    const instance = this.store.sessions()[0];
    if (!instance) return null;
    const minutes = sessionMinutes(instance);
    return {
      instance,
      time: formatSessionTime(instance.startAt),
      weekday: new Date(instance.startAt).toLocaleDateString(appLocale(), { weekday: 'short' }),
      title:
        instance.titleOverride ??
        instance.template?.title ??
        this._translateService.instant('common.session'),
      meta: [minutes ? formatSessionDuration(minutes) : '', instancePlaceLabel(instance)]
        .filter(Boolean)
        .join(' · '),
    };
  });

  /**
   * The sessions under day headers, as every session list in the app reads:
   * the day tapped on the calendar, else the chip's list. The row shows only
   * the time — it was built for lists that already say the day — so without
   * these, five past sessions read as five "15:00"s. The order is the
   * store's: soonest first ahead, most recent first behind.
   */
  readonly sessionDays = computed(() => {
    const sessions = this.store.sessionDay()
      ? this.store.daySessions()
      : this.sessionScope() === SessionScopes.Upcoming
        ? this.store.sessions()
        : this.store.pastSessions();
    const days: { key: string; label: string; instances: SessionInstance[] }[] = [];
    for (const instance of sessions) {
      const start = new Date(instance.startAt);
      const key = localDayKey(start);
      const last = days[days.length - 1];
      if (last?.key === key) last.instances.push(instance);
      else days.push({ key, label: sessionDayLabel(start), instances: [instance] });
    }
    return days;
  });

  /** More of the chip's list to read; none while a day is picked. */
  readonly hasMoreSessions = computed(() =>
    this.store.sessionDay()
      ? false
      : this.sessionScope() === SessionScopes.Upcoming
        ? this.store.hasMoreSessions()
        : this.store.hasMorePast(),
  );

  /** The chip's list is reading its next page. */
  readonly moreSessionsLoading = computed(() =>
    this.sessionScope() === SessionScopes.Upcoming
      ? this.store.upcomingLoading()
      : this.store.pastLoading(),
  );

  /** "Fri 30 Oct", the day the Sessions list is narrowed to. */
  readonly sessionDayLabel = computed(() => {
    const day = this.store.sessionDay();
    return day ? shortDayLabel(day) : '';
  });

  readonly weekPercent = computed(() => {
    const roster = this.store.roster();
    return roster ? adherenceLabel(roster) : '—';
  });

  readonly weekSub = computed(() => {
    const roster = this.store.roster();
    return roster ? lastActiveLabel(roster) : null;
  });

  /** "2 done · 1 skipped · 2 remaining" — the bar, in words. */
  readonly weekFootnote = computed(() => {
    const week = this.store.week();
    if (!week) return '';
    return this._translateService.instant('clients.detail.week.footnote', {
      completed: week.completed,
      skipped: week.skipped,
      remaining: week.remaining,
    });
  });

  /**
   * "Up from 50%" — the week's adherence against the one before, so a coach
   * can tell a dip from a habit. Silent when either week had nothing due: a
   * change from nothing is not a trend.
   */
  readonly weekTrend = computed(() => {
    const roster = this.store.roster();
    const current = roster?.adherencePercent;
    const previous = roster?.previousAdherencePercent;
    if (current == null || previous == null) return null;
    const delta = Math.round(current - previous);
    if (delta === 0) {
      return {
        direction: 'level',
        icon: 'remove-outline',
        label: this._translateService.instant('clients.detail.week.trend.level'),
      };
    }
    const params = { previous: Math.round(previous) };
    if (delta > 0) {
      return {
        direction: 'up',
        icon: 'trending-up-outline',
        label: this._translateService.instant('clients.detail.week.trend.upFrom', params),
      };
    }
    return {
      direction: 'down',
      icon: 'trending-down-outline',
      label: this._translateService.instant('clients.detail.week.trend.downFrom', params),
    };
  });

  /**
   * Why the roster flagged this week, in the web roster's words ("Dropping
   * off", "Down from 80% to 25%…"). Null when it is not flagged.
   */
  readonly attention = computed(() => {
    const roster = this.store.roster();
    return roster && this.store.week()?.flagged ? attentionReason(roster) : null;
  });

  /** Who a pending invite waits for: the first name, or the address the invite went to. */
  readonly firstName = computed(() => {
    const client = this.store.client();
    return client?.client?.firstName?.trim() || this.name();
  });

  /**
   * The plan the Overview names: the one under way, else a paused or a
   * waiting one (`currentPlans` is already in that order).
   */
  readonly overviewPlan = computed(() => {
    const row = this.store.currentPlans()[0];
    if (!row) return null;
    const paused = row.status === ProgramAssignmentStatus.Paused;
    const waiting = row.status === ProgramAssignmentStatus.Pending;
    return {
      row,
      paused,
      showBar: !paused && !waiting,
      kicker: this._translateService.instant(
        paused
          ? 'clients.detail.overview.planPaused'
          : waiting
            ? 'clients.detail.overview.planWaiting'
            : 'clients.detail.overview.planActive',
      ),
      line: assignmentSubline(row),
    };
  });

  /** Nothing to follow: the Overview's next step is to assign something. */
  readonly showNoPlan = computed(
    () => this.store.plansLoaded() && !this.store.currentPlans().length && this.canAssign(),
  );

  /** "52 min · 18 sets · felt 4/5", the history row's own line. */
  readonly lastMeta = computed(() => {
    const last = this.store.lastLog();
    return last ? logMeta(last) : '';
  });

  /** Under the name in the bar: how long they have been a client, or when an invite runs out. */
  readonly sinceLine = computed(() => {
    const client = this.store.client();
    if (!client) return '';
    const date = (iso: string) =>
      new Date(iso).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' });
    if (this.isPending()) {
      return client.expiresAt
        ? this._translateService.instant('clients.detail.expires', { date: date(client.expiresAt) })
        : '';
    }
    if (!client.startedAt) return '';
    return this._translateService.instant(
      this.isActive() ? 'clients.detail.clientSince' : 'clients.detail.since',
      { date: date(client.startedAt) },
    );
  });

  /** The Training list as a card per week: "Week of 14 Sep". */
  readonly workoutWeeks = computed(() => logWeeks(this.store.workouts()));

  /** "Wed 23 Oct", the day the list is narrowed to. */
  readonly dayLabel = computed(() => {
    const day = this.store.day();
    return day ? shortDayLabel(day) : '';
  });

  /** What an empty list says: about the day when one is picked, else the chip. */
  readonly workoutsEmpty = computed(() =>
    this._translateService.instant(
      this.store.day()
        ? 'clients.detail.training.empty.day'
        : `clients.detail.training.empty.${this.store.kind()}`,
    ),
  );

  readonly archiveTitle = computed(() => {
    const name = this.name();
    return name
      ? this._translateService.instant('clients.confirm.archive.title', { name })
      : this._translateService.instant('clients.confirm.archive.titleFallback');
  });

  constructor() {
    addIcons(CLIENT_ICONS);

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const clientId = params.get('clientId');
      if (clientId) this.store.load(clientId);
    });

    // A link to this page while it is still open switches the tab too.
    this._route.queryParamMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      this._tab.set(clientTabFrom(params.get('tab')));
    });

    // The Progress tab reads its numbers each time it is shown.
    effect(() => {
      const body = this._progressBody();
      if (body) untracked(() => body.load());
    });
  }

  /**
   * Ionic keeps this page alive in the stack. Coming back to it — from a
   * session, or the chat — re-reads silently so a note edited elsewhere or
   * a workout logged since shows without a flash. The first entry is the
   * route subscription's job, so it is skipped here.
   */
  ionViewWillEnter(): void {
    if (!this.store.client()) return;
    this.store.reload({ silent: true });
    this._progressBody()?.load();
  }

  /**
   * The strip and the Overview's rows. The address follows without a history
   * entry, and Overview, the default, leaves it clean.
   */
  setTab(value: unknown): void {
    const tab = clientTabFrom(value);
    if (tab === this._tab()) return;
    this._tab.set(tab);
    void this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { tab: tab === ClientTabs.Overview ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  openActions(): void {
    this.actionsOpen.set(true);
  }

  /** The sheet reports the verb; this screen decides what it means. */
  onAction(id: ClientActionId): void {
    switch (id) {
      case ClientActionIds.Message:
        this.message();
        return;
      case ClientActionIds.ViewProfile:
        this.openProfile();
        return;
      case ClientActionIds.EditNotes:
        this.openNotes();
        return;
      case ClientActionIds.Archive:
        this.confirmArchive();
        return;
      case ClientActionIds.Unarchive:
        this.unarchive();
        return;
    }
  }

  message(): void {
    const user = this.store.client()?.client;
    if (!user) return;
    this._openDirectMessage({ id: user.id, firstName: user.firstName, lastName: user.lastName });
  }

  openNotes(): void {
    this.notesOpen.set(true);
  }

  saveNotes(notes: string): void {
    if (this.notesSaving()) return;
    this.notesSaving.set(true);
    this.store.updateNotes(notes).subscribe({
      next: () => {
        this.notesSaving.set(false);
        this.notesOpen.set(false);
        void this._feedbackService.success(this._translateService.instant('clients.toast.noteSaved'));
      },
      error: (error: unknown) => {
        this.notesSaving.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant('clients.toast.noteFailed'),
        );
      },
    });
  }

  confirmArchive(): void {
    this.archiveOpen.set(true);
  }

  archive(): void {
    if (this.archiveSaving()) return;
    this.archiveSaving.set(true);
    this.store.archive().subscribe({
      next: () => {
        this.archiveSaving.set(false);
        this.archiveOpen.set(false);
        void this._feedbackService.success(this._translateService.instant('clients.toast.archived'));
      },
      error: (error: unknown) => {
        this.archiveSaving.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant('clients.toast.archiveFailed'),
        );
      },
    });
  }

  unarchive(): void {
    this.store.unarchive().subscribe({
      next: () =>
        void this._feedbackService.success(
          this._translateService.instant('clients.toast.unarchived'),
        ),
      error: (error: unknown) =>
        void this._feedbackService.error(
          error,
          this._translateService.instant('clients.toast.unarchiveFailed'),
        ),
    });
  }

  /** Pushed onto this stack, so back returns to the client, not the agenda. */
  openSession(instance: SessionInstance): void {
    void this._router.navigate([this._stack, 'session', instance.id]);
  }

  /** Who they are in public — the profile anyone else in the app would see. */
  openProfile(): void {
    const handle = this.handle();
    if (handle) void this._router.navigate([this._stack, 'person', handle]);
  }

  /** The plan itself, pushed onto this stack so back returns to the client. */
  openPlan(plan: ProgramAssignment): void {
    if (plan.masterProgramId) {
      void this._router.navigate([this._stack, 'program', plan.masterProgramId]);
    }
  }

  /** A logged workout, read in full — pushed onto this stack. A skip has none. */
  openLog(log: WorkoutLog): void {
    if (log.status === WorkoutLogStatus.Skipped) return;
    void this._router.navigate([this._stack, 'log', log.id]);
  }

  setKind(kind: TrainingKind): void {
    this.store.setKind(kind);
  }

  toggleCalendar(): void {
    this.calendarOpen.update((open) => !open);
  }

  /** A tapped calendar day narrows the list below to it. */
  onDaySelect(key: string): void {
    this.store.setDay(key);
  }

  clearDay(): void {
    this.store.setDay(null);
  }

  /** A chip returns from a picked day to its list. */
  setSessionScope(value: unknown): void {
    if (value === SessionScopes.Upcoming || value === SessionScopes.Past) {
      this._sessionScope.set(value);
      this.store.setSessionDay(null);
    }
  }

  toggleSessionCalendar(): void {
    this.sessionCalendarOpen.update((open) => !open);
  }

  /** A tapped calendar day narrows the Sessions list to it. */
  onSessionDay(date: Date): void {
    this.store.setSessionDay(localDayKey(date));
  }

  clearSessionDay(): void {
    this.store.setSessionDay(null);
  }

  togglePastPlans(): void {
    this.pastPlansOpen.update((open) => !open);
  }

  openAssign(): void {
    this.assignOpen.set(true);
  }

  onAssign(request: AssignRequest): void {
    const programId = request.programId;
    const clientId = this.store.client()?.clientId;
    if (!programId || !clientId || this.assignSaving()) return;
    this.assignSaving.set(true);
    this.store.assignPlan({ ...request, programId, clientId }).subscribe({
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

  setPlanStatus(plan: ProgramAssignment, status: ProgramAssignmentStatus): void {
    this.store.setPlanStatus(plan, status)?.subscribe({
      error: (error: unknown) =>
        void this._feedbackService.error(
          error,
          this._translateService.instant('programs.assignments.toast.statusFailed'),
        ),
    });
  }

  retry(): void {
    this.store.reload();
  }
}
