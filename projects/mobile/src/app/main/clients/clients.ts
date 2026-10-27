import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  InfiniteScrollCustomEvent,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import {
  InstructorClient,
  clientDisplayName,
  isIncomingRequest,
  isOpenableClient,
  isSentInvite,
} from 'core';

import { ConfirmSheet } from '../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { RowSkeleton } from '../../_shared/components/row-skeleton/row-skeleton';
import { SearchStart } from '../../_shared/components/search-start/search-start';
import { StaleBar } from '../../_shared/components/stale-bar/stale-bar';
import {
  RecentPerson,
  RecentSearchScopes,
  SuggestedPerson,
  SuggestionStrip,
} from '../../_shared/config/recent-searches.config';
import { ClockService } from '../../_shared/services/clock.service';
import { FeedbackService } from '../../_shared/services/feedback.service';
import { injectOpenDirectMessage } from '../../_shared/utils/direct-message';
import { SearchHeaderFold } from '../../_shared/utils/fold';
import { injectRecentSearches } from '../../_shared/utils/recent-searches';
import { ClientRow } from './_components/client-row/client-row';
import { ClientsEmpty } from './_components/clients-empty/clients-empty';
import { ClientsRefreshService } from './_services/clients-refresh.service';
import { ClientNotesSheet } from './_sheets/client-notes-sheet/client-notes-sheet';
import { RequestSheet } from './_sheets/request-sheet/request-sheet';
import {
  RequestActionId,
  RequestActionIds,
  newestClients,
  pendingClients,
  recentFromClient,
} from './clients.config';
import { CLIENT_INVITE_PATH } from './client-paths';
import {
  CLIENT_FILTERS,
  ClientFilterId,
  ClientFilterIds,
  MIN_SEARCH_LENGTH,
  filterFromUrl,
} from './clients.filters';
import { CLIENT_ICONS } from './clients.icons';
import { ClientsStore } from './clients.store';

/**
 * The coach's Clients tab: one flat list (`mh-flat-list`) of every
 * relationship and request, chip-filtered by status and searchable by name,
 * laid out like the Messages inbox. Requests are the Requests chip; a
 * pending row opens the request sheet, where it is answered, resent or
 * withdrawn. See `ClientsStore`.
 */
@Component({
  selector: 'mh-clients',
  imports: [
    ClientNotesSheet,
    ClientRow,
    ClientsEmpty,
    ConfirmSheet,
    EmptyState,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonList,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonTitle,
    IonToolbar,
    NotificationBell,
    RequestSheet,
    RowSkeleton,
    SearchStart,
    StaleBar,
    TranslatePipe,
  ],
  templateUrl: './clients.html',
  styleUrl: './clients.scss',
  providers: [ClientsStore],
})
export class Clients implements ViewWillEnter {
  readonly store = inject(ClientsStore);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _clockService = inject(ClockService);
  private readonly _clientsRefreshService = inject(ClientsRefreshService);
  private readonly _translateService = inject(TranslateService);
  private readonly _openDirectMessage = injectOpenDirectMessage();
  private readonly _searchbar = viewChild(IonSearchbar);

  readonly recents = injectRecentSearches(RecentSearchScopes.Clients);

  /** Folds the title, the pills and the back chevron as search opens and closes. */
  readonly fold = new SearchHeaderFold();

  /**
   * Pending requests, then the newest active clients, both from the
   * unfiltered list already on screen. Read only while nothing is typed, when
   * that list is the whole first page, newest first.
   */
  readonly strips = computed<SuggestionStrip[]>(() => {
    const clients = this.store.visibleClients();
    return [
      {
        label: this._translateService.instant('clients.list.pendingStrip'),
        people: pendingClients(clients),
      },
      {
        label: this._translateService.instant('clients.list.newest'),
        people: newestClients(
          clients,
          this.recents.entries().map((person) => person.id),
        ),
      },
    ];
  });

  /**
   * Search is open and nothing is typed yet: recents, pending requests and
   * the newest clients, as Messenger opens its search. With none of them the
   * list stays, which is still something to search through.
   */
  readonly showSearchStart = computed(
    () =>
      this.searchOpen() &&
      !this.store.query().trim() &&
      (this.recents.entries().length > 0 ||
        this.strips().some((strip) => strip.people.length > 0)),
  );

  readonly filters = CLIENT_FILTERS;
  readonly minSearchLength = MIN_SEARCH_LENGTH;
  readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7, 8];

  /** Focusing the search field folds the title and the pills away. */
  readonly searchOpen = signal(false);

  // The row a swipe verb is about, per sheet. Each sheet keeps its own so a
  // second swipe while one is open cannot swap the person under it.
  readonly notesOpen = signal(false);
  readonly notesClient = signal<InstructorClient | null>(null);
  readonly notesSaving = signal(false);

  readonly archiveOpen = signal(false);
  readonly archiving = signal<InstructorClient | null>(null);
  readonly archiveSaving = signal(false);

  readonly requestOpen = signal(false);
  readonly requestClient = signal<InstructorClient | null>(null);

  /**
   * Invitations resent during this visit. The BE refuses a third resend in a
   * row with a 429, but the sheet should never offer it: once is plenty, and
   * the verb says so rather than going quiet. Cleared on entry, so coming
   * back to the tab allows another.
   */
  private readonly _resent = signal<ReadonlySet<string>>(new Set());

  readonly requestResent = computed(() => {
    const client = this.requestClient();
    return !!client && this._resent().has(client.id);
  });

  readonly withdrawOpen = signal(false);
  readonly withdrawing = signal<InstructorClient | null>(null);
  readonly withdrawSaving = signal(false);

  readonly archiveTitle = computed(() => {
    const client = this.archiving();
    return client
      ? this._translateService.instant('clients.confirm.archive.title', {
          name: clientDisplayName(client),
        })
      : this._translateService.instant('clients.confirm.archive.titleFallback');
  });

  readonly withdrawBody = computed(() => {
    const client = this.withdrawing();
    const fallback = this._translateService.instant('clients.thisPerson');
    const who = client ? clientDisplayName(client, fallback) : fallback;
    return this._translateService.instant('clients.confirm.withdraw.body', { name: who });
  });

  /**
   * What a screen reader is told once a search or a filter settles. Nothing
   * is on screen to say it otherwise: the list simply becomes shorter.
   *
   * Empty while a term is still on its way — announcing "3 clients" over a
   * list about to be replaced is worse than saying nothing — and empty when
   * nothing is narrowing, where the count is just the page's own length.
   */
  readonly resultAnnouncement = computed(() => {
    const narrowing = !!this.store.query().trim() || this.store.filter() !== ClientFilterIds.All;
    if (!narrowing || !this.store.searchSettled() || this.store.showSkeleton()) return '';

    const count = this.store.visibleClients().length;
    if (count === 0) return this._translateService.instant('clients.list.results.none');
    return this._translateService.instant('clients.list.results.count', { count });
  });

  constructor() {
    addIcons(CLIENT_ICONS);

    // Home's requests banner and a request notification open this tab on a
    // chip through `?filter=`. Read on every arrival rather than once, since
    // the page stays alive in the stack, but not on a back navigation: that
    // returns to the URL that once carried it, and would undo a chip the
    // coach has changed since.
    let popstate = false;
    this._router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) popstate = event.navigationTrigger === 'popstate';
      if (event instanceof NavigationEnd && !popstate) this._applyUrlFilter(event.urlAfterRedirects);
    });
  }

  // Not ngOnInit: Ionic keeps the page alive in the tab stack. An invite, an
  // accepted request or an archive elsewhere changes this list, so entering
  // refetches — quietly, since rows already on screen stay put. `reenter`
  // holds that back for a few seconds, so stepping into a client and straight
  // back out does not re-fire the list and the count for data seconds old.
  //
  // An invitation just sent is the one change `reenter`'s window would hide:
  // it measures time since the last load, not time on the page, so the normal
  // path — open the tab, invite, come back — lands inside it. The invite page
  // says so through `ClientsRefreshService`, read here because every way back
  // fires this hook, and acted on with one load: a chip change reloads by
  // itself, so only an unchanged chip needs the refresh.
  ionViewWillEnter(): void {
    this._resent.set(new Set());

    const pending = this._clientsRefreshService.consume();
    if (!pending) {
      this.store.reenter();
    } else if (pending.filter && this._showFilter(pending.filter)) {
      this.store.loadPendingCount();
    } else {
      this.store.refresh();
    }
  }

  setFilter(id: ClientFilterId): void {
    this.store.setFilter(id);
  }

  /**
   * Search covers every client: the pills fold away with the title, so a
   * chip left on would narrow the results with nothing on screen saying so.
   */
  openSearch(): void {
    this.fold.arm();
    this.searchOpen.set(true);
    this.store.setFilter(ClientFilterIds.All);
  }

  closeSearch(): void {
    this.fold.arm();
    this.searchOpen.set(false);
    this.store.setQuery('');
    // Otherwise the field keeps focus, the keyboard stays up, and the next
    // tap on it fires no focus event to open search again.
    void this._searchbar()
      ?.getInputElement()
      .then((input) => input.blur());
  }

  onQuery(value: string): void {
    this.store.setQuery(value);
  }

  /**
   * Drops the chip and the search together. Closes search directly rather
   * than via `closeSearch`, so clearing both does not fire one request for
   * the emptied term and a second for the reset chip.
   */
  clearFilters(): void {
    this.fold.arm();
    this.searchOpen.set(false);
    this.store.clearFilters();
  }

  /**
   * A relationship row opens the profile. A pending one has no profile yet,
   * in either direction (an incoming request needs a decision, a sent
   * invitation can be resent or withdrawn), so it opens the request sheet.
   * A row that did nothing at all on tap just read as broken.
   */
  open(client: InstructorClient): void {
    if (isOpenableClient(client)) {
      // A profile opened from search is where that search ended.
      const recent = this.searchOpen() ? recentFromClient(client) : null;
      if (recent) this.recents.push(recent);
      void this._router.navigate(['/tabs/clients', client.clientId]);
      return;
    }
    if (isIncomingRequest(client) || isSentInvite(client)) {
      this.openRequest(client);
    }
  }

  openRequest(client: InstructorClient): void {
    this._clockService.bump();
    this.requestClient.set(client);
    this.requestOpen.set(true);
  }

  /**
   * A recent or a suggestion: remembered, then the profile. A waiting
   * invitation has no profile yet, so it opens the request sheet and is not
   * remembered. The strip was built from the rows on screen, so its row is
   * still there to open.
   */
  openRecent(person: SuggestedPerson): void {
    if (person.pendingLabel) {
      const client = this.store.visibleClients().find((row) => row.id === person.id);
      if (client) this.openRequest(client);
      return;
    }
    this.recents.push(person);
    void this._router.navigate(['/tabs/clients', person.id]);
  }

  removeRecent(person: RecentPerson): void {
    this.recents.remove(person.id);
  }

  clearRecents(): void {
    this.recents.clear();
  }

  /** Inviting is its own page now, pushed onto this tab's stack. */
  openInvite(): void {
    void this._router.navigate([CLIENT_INVITE_PATH]);
  }

  // ── Row verbs ────────────────────────────────────────────────────────────
  // Every store verb below is already cancelled with this page — the store is
  // provided here and pipes `takeUntilDestroyed` on its own destroy ref — so
  // none of these handlers can run against a view that is gone.

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

  /** Restoring is its own undo, so no sheet — one swipe, done. */
  unarchive(client: InstructorClient): void {
    this.store.unarchive(client).subscribe({
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

  /** The sheet has gone by now, so a verb that navigates or opens a sheet is safe. */
  onRequestAction(id: RequestActionId): void {
    const client = this.requestClient();
    if (!client) return;

    switch (id) {
      case RequestActionIds.Accept:
        this.accept(client);
        break;
      case RequestActionIds.Decline:
        this.decline(client);
        break;
      case RequestActionIds.Resend:
        this.resend(client);
        break;
      case RequestActionIds.Withdraw:
        this.confirmWithdraw(client);
        break;
      case RequestActionIds.ViewProfile: {
        // Who is asking, before saying yes: their public profile, in this stack.
        const handle = client.client?.handle;
        if (handle) void this._router.navigate(['/tabs/clients/person', handle]);
        break;
      }
    }
  }

  accept(client: InstructorClient): void {
    this.store.accept(client).subscribe({
      next: () =>
        void this._feedbackService.success(
          this._translateService.instant('clients.toast.requestAccepted'),
        ),
      error: (error: unknown) =>
        void this._feedbackService.error(
          error,
          this._translateService.instant('clients.toast.requestFailed'),
        ),
    });
  }

  decline(client: InstructorClient): void {
    this.store.decline(client).subscribe({
      next: () =>
        void this._feedbackService.success(
          this._translateService.instant('clients.toast.requestDeclined'),
        ),
      error: (error: unknown) =>
        void this._feedbackService.error(
          error,
          this._translateService.instant('clients.toast.requestFailed'),
        ),
    });
  }

  resend(client: InstructorClient): void {
    if (this._resent().has(client.id)) return;
    this.store.resend(client).subscribe({
      next: () => {
        this._resent.update((ids) => new Set(ids).add(client.id));
        void this._feedbackService.success(
          this._translateService.instant('clients.toast.invitationResent'),
        );
      },
      error: (error: unknown) =>
        void this._feedbackService.error(
          error,
          this._translateService.instant('clients.toast.resendFailed'),
        ),
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
        void this._feedbackService.success(
          this._translateService.instant('clients.toast.invitationWithdrawn'),
        );
      },
      error: (error: unknown) => {
        this.withdrawSaving.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant('clients.toast.withdrawFailed'),
        );
      },
    });
  }

  /**
   * A refresh that fails leaves the rows that were already there, which is
   * right — but silently, they read as fresh. The stale bar above the list
   * says so and offers the retry, and it stays put until a load succeeds.
   *
   * No toast on top of it. A pull with no connection used to produce a
   * blocking alert, a toast and the bar — the same news three times, two of
   * them transient. The loads are `silentRequest()` now (the alert), and the
   * bar is the one that survives long enough to be acted on (the toast).
   * Toasts stay for the writes below, where there is nothing else to show.
   */
  onRefresh(event: RefresherCustomEvent): void {
    this.store.refresh(() => void event.target.complete());
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    this.store.loadMore(() => void event.target.complete());
  }

  retry(): void {
    this.store.refresh();
  }

  /** The chip a Clients tab URL asks for, if any. */
  private _applyUrlFilter(url: string): void {
    const id = filterFromUrl(url);
    if (id) this._showFilter(id);
  }

  /**
   * Puts the list on a chip someone else asked for: a URL or the invite page.
   * Search covers every client and hides the chips, so it closes first;
   * otherwise the chip would narrow the results with nothing on screen saying
   * so. True when the chip changed, which reloads the list.
   */
  private _showFilter(id: ClientFilterId): boolean {
    if (this.searchOpen()) this.closeSearch();
    return this.store.setFilter(id);
  }
}
