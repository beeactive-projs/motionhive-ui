import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import {
  InstructorClient,
  RosterClient,
  clientDisplayName,
  isIncomingRequest,
  isOpenableClient,
} from 'core';

import { ConfirmSheet } from '../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { FeedbackService } from '../../_shared/services/feedback.service';
import { injectOpenDirectMessage } from '../../_shared/utils/direct-message';
import { AttentionRow } from './_components/attention-row/attention-row';
import { ClientRow } from './_components/client-row/client-row';
import { ClientsEmpty } from './_components/clients-empty/clients-empty';
import { OnTrackRow } from './_components/on-track-row/on-track-row';
import { ClientNotesSheet } from './_sheets/client-notes-sheet/client-notes-sheet';
import { InviteClientSheet } from './_sheets/invite-client-sheet/invite-client-sheet';
import {
  CLIENT_FILTERS,
  CLIENT_ICONS,
  ClientFilterId,
  ClientsSegments,
  triageNote,
} from './clients.config';
import { ClientsStore } from './clients.store';

/**
 * The coach's Clients tab: triage first, everyone second.
 *
 * Needs attention is the landing lens — who slipped this week and why, read
 * off the roster. All clients is the directory: every relationship and
 * request, chip-filtered by status and searchable by name. Both load on
 * entry so the segment switch never waits; see `ClientsStore`.
 */
@Component({
  selector: 'mh-clients',
  imports: [
    AttentionRow,
    ClientNotesSheet,
    ClientRow,
    ClientsEmpty,
    ConfirmSheet,
    EmptyState,
    HexAvatar,
    IonBadge,
    IonButton,
    IonButtons,
    IonChip,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    InviteClientSheet,
    NotificationBell,
    OnTrackRow,
    RouterLink,
  ],
  templateUrl: './clients.html',
  styleUrl: './clients.scss',
  providers: [ClientsStore],
})
export class Clients implements ViewWillEnter {
  readonly store = inject(ClientsStore);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _openDirectMessage = injectOpenDirectMessage();

  readonly Segments = ClientsSegments;
  readonly filters = CLIENT_FILTERS;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  /**
   * Search owns the whole toolbar while it is open — a title, three actions,
   * a segment and a chip row do not fit above the fold on a phone. Same
   * treatment as the inbox and the agenda. Only the directory is searchable.
   */
  readonly searchOpen = signal(false);

  readonly inviteOpen = signal(false);

  // The row a swipe verb is about, per sheet. Each sheet keeps its own so a
  // second swipe while one is open cannot swap the person under it.
  readonly notesOpen = signal(false);
  readonly notesClient = signal<InstructorClient | null>(null);
  readonly notesSaving = signal(false);

  readonly archiveOpen = signal(false);
  readonly archiving = signal<InstructorClient | null>(null);
  readonly archiveSaving = signal(false);

  readonly withdrawOpen = signal(false);
  readonly withdrawing = signal<InstructorClient | null>(null);
  readonly withdrawSaving = signal(false);

  readonly archiveTitle = computed(() => {
    const client = this.archiving();
    return `Archive ${client ? clientDisplayName(client) : 'this client'}?`;
  });

  readonly withdrawBody = computed(() => {
    const client = this.withdrawing();
    const who = client ? clientDisplayName(client, 'this person') : 'this person';
    return `${who} will no longer be able to accept it. You can invite them again later.`;
  });

  readonly isAttention = computed(() => this.store.segment() === ClientsSegments.Attention);

  /** "3 of 8 clients need a look" — beside the This week kicker. */
  readonly triageNote = computed(() =>
    triageNote(this.store.attentionCount(), this.store.rosterTotal()),
  );

  readonly onTrackNote = computed(() => {
    const count = this.store.onTrackClients().length;
    return `${count} ${count === 1 ? 'client' : 'clients'}`;
  });

  /** The count lives in the label only — the dot itself says "some", never how many. */
  readonly requestsLabel = computed(() => {
    const count = this.store.pendingCount();
    return count > 0 ? `Requests, ${count} pending` : 'Requests';
  });

  constructor() {
    addIcons(CLIENT_ICONS);
  }

  // Not ngOnInit: Ionic keeps the page alive in the tab stack. An invite, an
  // accepted request or an archive elsewhere changes this list, so entering
  // always refetches — silently, since rows already on screen stay put.
  ionViewWillEnter(): void {
    this.store.refresh();
  }

  setSegment(value: string | number | undefined): void {
    if (value !== ClientsSegments.Attention && value !== ClientsSegments.All) return;
    if (value === ClientsSegments.Attention) this.closeSearch();
    this.store.setSegment(value);
  }

  setFilter(id: ClientFilterId): void {
    this.store.setFilter(id);
  }

  openSearch(): void {
    this.searchOpen.set(true);
  }

  closeSearch(): void {
    this.searchOpen.set(false);
    this.store.query.set('');
  }

  onQuery(value: string): void {
    this.store.query.set(value);
  }

  clearFilters(): void {
    this.closeSearch();
    this.store.clearFilters();
  }

  showAll(): void {
    this.store.setSegment(ClientsSegments.All);
  }

  openRoster(client: RosterClient): void {
    void this._router.navigate(['/tabs/clients', client.clientId]);
  }

  /**
   * A relationship row opens the profile. An incoming request has no profile
   * yet — the decision it needs lives on the Requests page, so that is where
   * the tap goes. Everything else (sent invites) is inert.
   */
  open(client: InstructorClient): void {
    if (isOpenableClient(client)) {
      void this._router.navigate(['/tabs/clients', client.clientId]);
      return;
    }
    if (isIncomingRequest(client)) {
      void this._router.navigateByUrl('/tabs/clients/requests');
    }
  }

  openInvite(): void {
    this.inviteOpen.set(true);
  }

  // ── Row verbs ────────────────────────────────────────────────────────────

  /** Reopens the existing thread, or the draft chat if there is none yet. */
  message(client: InstructorClient): void {
    const user = client.client;
    if (!user) return;
    this._openDirectMessage({ id: user.id, firstName: user.firstName, lastName: user.lastName });
  }

  openNotes(client: InstructorClient): void {
    this.notesClient.set(client);
    this.notesOpen.set(true);
  }

  saveNotes(notes: string): void {
    const client = this.notesClient();
    if (!client || this.notesSaving()) return;

    this.notesSaving.set(true);
    this.store.updateNotes(client, notes).subscribe({
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

  confirmArchive(client: InstructorClient): void {
    this.archiving.set(client);
    this.archiveOpen.set(true);
  }

  archive(): void {
    const client = this.archiving();
    if (!client || this.archiveSaving()) return;

    this.archiveSaving.set(true);
    this.store.archive(client).subscribe({
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

  /** Restoring is its own undo, so no sheet — one swipe, done. */
  unarchive(client: InstructorClient): void {
    this.store.unarchive(client).subscribe({
      next: () => void this._feedbackService.success('Client unarchived'),
      error: (error: unknown) =>
        void this._feedbackService.error(error, 'Could not unarchive this client.'),
    });
  }

  confirmWithdraw(client: InstructorClient): void {
    this.withdrawing.set(client);
    this.withdrawOpen.set(true);
  }

  withdraw(): void {
    const client = this.withdrawing();
    if (!client || this.withdrawSaving()) return;

    this.withdrawSaving.set(true);
    this.store.withdraw(client).subscribe({
      next: () => {
        this.withdrawSaving.set(false);
        this.withdrawOpen.set(false);
        void this._feedbackService.success('Invitation withdrawn');
      },
      error: (error: unknown) => {
        this.withdrawSaving.set(false);
        void this._feedbackService.error(error, 'Could not withdraw the invitation.');
      },
    });
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.refresh(() => void event.target.complete());
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    this.store.loadMore(() => void event.target.complete());
  }

  retry(): void {
    this.store.refresh();
  }
}
