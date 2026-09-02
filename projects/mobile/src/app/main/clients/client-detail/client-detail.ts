import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import {
  InstructorClientStatuses,
  SessionInstance,
  clientDisplayName,
  clientEmail,
  clientStatusLabel,
} from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { injectOpenDirectMessage } from '../../../_shared/utils/direct-message';
import { SessionRow } from '../../coach/sessions/_components/session-row/session-row';
import { ClientActionsSheet } from '../_sheets/client-actions-sheet/client-actions-sheet';
import { ClientNotesSheet } from '../_sheets/client-notes-sheet/client-notes-sheet';
import {
  CLIENT_ICONS,
  ClientActionId,
  ClientActionIds,
  adherenceLabel,
  lastActiveLabel,
} from '../clients.config';
import { ClientDetailStore } from './client-detail.store';

/**
 * One client: who they are, how their week is going, what is coming up, and
 * the coach's private notes. Only grounded sections — the This week card and
 * the Plan row exist only when the roster has this person, Upcoming sessions
 * only when there are any — so nothing on the screen is invented.
 *
 * The URL is the source of truth: a refresh, a deep link, or a tap from any
 * list all land here with the client's user id and load from it.
 */
@Component({
  selector: 'mh-client-detail',
  imports: [
    ClientActionsSheet,
    ClientNotesSheet,
    ConfirmSheet,
    DatePipe,
    EmptyState,
    HexAvatar,
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
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    SessionRow,
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
  private readonly _openDirectMessage = injectOpenDirectMessage();

  readonly Statuses = InstructorClientStatuses;
  readonly skeletonRows = [1, 2, 3];

  readonly actionsOpen = signal(false);
  readonly notesOpen = signal(false);
  readonly notesSaving = signal(false);
  readonly archiveOpen = signal(false);
  readonly archiveSaving = signal(false);

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
        return 'warn';
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
    return `${week.completed} done · ${week.skipped} skipped · ${week.remaining} remaining`;
  });

  readonly planLabel = computed(() => {
    const count = this.store.activePlans();
    if (count === null || count === 0) return 'No active plan';
    return count === 1 ? '1 active plan' : `${count} active plans`;
  });

  readonly archiveTitle = computed(() => `Archive ${this.name() || 'this client'}?`);

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
        void this._feedbackService.success('Note saved');
      },
      error: (error: unknown) => {
        this.notesSaving.set(false);
        void this._feedbackService.error(error, 'Could not save the note.');
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
        void this._feedbackService.success('Client archived');
      },
      error: (error: unknown) => {
        this.archiveSaving.set(false);
        void this._feedbackService.error(error, 'Could not archive this client.');
      },
    });
  }

  unarchive(): void {
    this.store.unarchive().subscribe({
      next: () => void this._feedbackService.success('Client unarchived'),
      error: (error: unknown) =>
        void this._feedbackService.error(error, 'Could not unarchive this client.'),
    });
  }

  /** Cross-tab jump: the session opens in its own stack, back returns here. */
  openSession(instance: SessionInstance): void {
    void this._router.navigate(['/tabs/coach/sessions', instance.id]);
  }

  retry(): void {
    this.store.reload();
  }
}
