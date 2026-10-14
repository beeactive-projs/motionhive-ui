import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonChip,
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
  clientDisplayName,
  clientEmail,
  clientStatusLabel,
  localDayKey,
  sessionDayLabel,
} from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { injectOpenDirectMessage } from '../../../_shared/utils/direct-message';
import { SessionRow } from '../../coach/sessions/_components/session-row/session-row';
import {
  AssignmentRow,
  AssignmentRowSubjects,
} from '../../programs/_components/assignment-row/assignment-row';
import { AssignRequest, AssignSheet } from '../../programs/_sheets/assign-sheet/assign-sheet';
import { ClientActionsSheet } from '../_sheets/client-actions-sheet/client-actions-sheet';
import { ClientNotesSheet } from '../_sheets/client-notes-sheet/client-notes-sheet';
import { ClientActionId, ClientActionIds } from '../clients.config';
import { CLIENT_ICONS } from '../clients.icons';
import { clientPath, coachStackOf } from '../client-paths';
import { adherenceLabel, lastActiveLabel } from '../roster-labels';
import { ClientDetailStore, PAST_DAYS, UPCOMING_DAYS } from './client-detail.store';

/** Which way the Sessions section looks. */
const SessionScopes = {
  Upcoming: 'upcoming',
  Past: 'past',
} as const;
type SessionScope = (typeof SessionScopes)[keyof typeof SessionScopes];

/**
 * One client: who they are, how their week is going, the plans they are on,
 * their sessions either side of today, and the coach's private notes. Only
 * grounded sections — the This week card exists only when the roster has
 * this person, Sessions only when there are any — so nothing on the screen
 * is invented.
 *
 * Mounted under Clients and under Programs (from a plan's list of who is on
 * it); every link out stays in whichever stack it was opened in, so back
 * always returns here. See `client-paths.ts`.
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
    IonBackButton,
    IonBadge,
    IonChip,
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
  /** Past plans are a record; folded away until asked for. */
  readonly pastPlansOpen = signal(false);
  /** Null until the coach picks: the default follows what there is to show. */
  private readonly _sessionScope = signal<SessionScope | null>(null);

  readonly name = computed(() => {
    const client = this.store.client();
    return client ? clientDisplayName(client) : '';
  });

  readonly email = computed(() => {
    const client = this.store.client();
    return client ? clientEmail(client) : '';
  });

  readonly avatarTone = computed(() => avatarToneFor(this.store.client()?.clientId));

  readonly statusLabel = computed(() => {
    const client = this.store.client();
    return client ? clientStatusLabel(client) : '';
  });

  /** Active is a wash of green; the two that need noticing take warn / neutral. */
  readonly statusTone = computed(() => {
    switch (this.store.client()?.status) {
      case InstructorClientStatuses.Active:
        return 'success';
      case InstructorClientStatuses.Archived:
        return 'medium';
      default:
        return 'warning';
    }
  });

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

  readonly showSessions = computed(
    () => this.store.sessions().length > 0 || this.store.pastSessions().length > 0,
  );

  /**
   * The scope's sessions under day headers, as every session list in the app
   * reads. The row shows only the time — it was built for lists that already
   * say the day — so without these five past sessions read as five "15:00"s.
   * The order is the store's: soonest first ahead, most recent first behind.
   */
  readonly sessionDays = computed(() => {
    const sessions =
      this.sessionScope() === SessionScopes.Upcoming
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
   * "12 points up on last week" — the week's adherence against the one
   * before, so a coach can tell a dip from a habit. Silent when either week
   * had nothing due: a change from nothing is not a trend.
   */
  readonly weekTrend = computed(() => {
    const roster = this.store.roster();
    const current = roster?.adherencePercent;
    const previous = roster?.previousAdherencePercent;
    if (current == null || previous == null) return null;
    const delta = Math.round(current - previous);
    if (delta === 0) return this._translateService.instant('clients.detail.week.trend.level');
    return this._translateService.instant(
      delta > 0 ? 'clients.detail.week.trend.up' : 'clients.detail.week.trend.down',
      { count: Math.abs(delta) },
    );
  });

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
  }

  /**
   * Ionic keeps this page alive in the stack. Coming back to it — from a
   * session, or the chat — re-reads silently so a note edited elsewhere or
   * a workout logged since shows without a flash. The first entry is the
   * route subscription's job, so it is skipped here.
   */
  ionViewWillEnter(): void {
    if (this.store.client()) this.store.reload({ silent: true });
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

  /** Cross-tab jump: the session opens in its own stack, back returns here. */
  openSession(instance: SessionInstance): void {
    void this._router.navigate(['/tabs/coach/sessions', instance.id]);
  }

  /** Who they are in public — the profile anyone else in the app would see. */
  openProfile(): void {
    const handle = this.handle();
    if (handle) void this._router.navigate([this._stack, 'person', handle]);
  }

  /** Their plan and what they have logged — pushed onto this stack. */
  openTraining(): void {
    const clientId = this.store.client()?.clientId;
    if (clientId) {
      void this._router.navigate([...clientPath(this._stack, clientId), 'training']);
    }
  }

  /** Their numbers and records; the name rides along for the header. */
  openProgress(): void {
    const clientId = this.store.client()?.clientId;
    if (clientId) {
      void this._router.navigate([...clientPath(this._stack, clientId), 'progress'], {
        state: { clientName: this.name() },
      });
    }
  }

  setSessionScope(value: unknown): void {
    if (value === SessionScopes.Upcoming || value === SessionScopes.Past) {
      this._sessionScope.set(value);
    }
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
    if (!programId || !clientId) return;
    this.store.assignPlan({ ...request, programId, clientId }).subscribe({
      next: () =>
        void this._feedbackService.success(
          this._translateService.instant('programs.assignments.toast.assigned'),
        ),
      error: (error: unknown) =>
        void this._feedbackService.error(
          error,
          this._translateService.instant('programs.assignments.toast.assignFailed'),
        ),
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
