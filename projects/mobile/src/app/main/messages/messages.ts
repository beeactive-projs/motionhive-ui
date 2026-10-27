import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
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
  InfiniteScrollCustomEvent,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import {
  ConversationListItem,
  InboxFilter,
  MessagingStore,
  UserBlockReason,
  displayName,
} from 'core';

import { ActionSheet } from '../../_shared/components/action-sheet/action-sheet';
import { ConfirmSheet } from '../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../_shared/services/feedback.service';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { SearchStart } from '../../_shared/components/search-start/search-start';
import { RecentPerson, RecentSearchScopes } from '../../_shared/config/recent-searches.config';
import { SearchHeaderFold } from '../../_shared/utils/fold';
import { injectPeopleSearch } from '../../_shared/utils/people-search';
import { injectRecentSearches } from '../../_shared/utils/recent-searches';
import { ConversationRow } from './_components/conversation-row/conversation-row';
import { PersonRow } from '../../_shared/components/person-row/person-row';
import { RowSkeleton } from '../../_shared/components/row-skeleton/row-skeleton';
import { BlockUserSheet } from './_sheets/block-user-sheet/block-user-sheet';
import {
  ConversationAction,
  ConversationActions,
  MESSAGING_ICONS,
  conversationActions,
  frequentContacts,
  recentFromPerson,
} from './messages.config';

/**
 * The inbox: conversations, filters, search, and the way into a new one.
 *
 * State lives in core's `MessagingStore`, shared with the web app — this page
 * holds no conversation data of its own. That covers realtime too: the store
 * connects the stream on login, so rows reorder and unread counts move without
 * this page polling.
 *
 * Search returns two lists from two sources. Conversations are filtered in the
 * store, already in memory; people come from `/users/search`. The header's
 * "+" is the other way to a first message: its own page, `NewMessage`.
 */
@Component({
  selector: 'mh-messages',
  imports: [
    ActionSheet,
    BlockUserSheet,
    ConfirmSheet,
    ConversationRow,
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
    PersonRow,
    RowSkeleton,
    SearchStart,
    TranslatePipe,
  ],
  templateUrl: './messages.html',
  styleUrl: './messages.scss',
})
export class Messages implements ViewWillEnter {
  readonly store = inject(MessagingStore);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly people = injectPeopleSearch();
  readonly results = computed(() => this.people.results().map(recentFromPerson));
  readonly recents = injectRecentSearches(RecentSearchScopes.Messages);

  /** Folds the title, the pills and the back chevron as search opens and closes. */
  readonly fold = new SearchHeaderFold();

  private readonly _searchbar = viewChild(IonSearchbar);

  /**
   * The subset of `InboxFilter` this app offers — the store also knows
   * 'groups' and 'coaches', which have no screen behind them yet. Narrower
   * than `InboxFilter` on purpose: these are the keys `filterCounts` returns.
   */
  readonly Filters = {
    All: 'all',
    Unread: 'unread',
  } as const satisfies Record<string, InboxFilter>;

  /** The pills. Labels are translation keys; the template translates them. */
  readonly filters = [
    { value: this.Filters.All, label: 'common.all' },
    { value: this.Filters.Unread, label: 'messages.inbox.filterUnread' },
  ] as const;

  readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7, 8];
  readonly peopleSkeletonRows = [1, 2, 3];

  /** Focusing the search field folds the title and the pills away. */
  readonly searchOpen = signal(false);

  /** The row whose More was tapped; the More, delete and block sheets act on it. */
  private readonly _actionTarget = signal<ConversationListItem | null>(null);
  readonly actionsOpen = signal(false);
  readonly blockOpen = signal(false);
  readonly deleteOpen = signal(false);
  readonly deleting = signal(false);

  readonly actionTitle = computed(() => {
    const target = this._actionTarget();
    return target?.otherUser ? displayName(target.otherUser) : (target?.name ?? '');
  });

  readonly actionSubtitle = computed(() => {
    const handle = this._actionTarget()?.otherUser?.handle;
    return handle ? `@${handle}` : '';
  });

  readonly actions = computed(() => {
    const target = this._actionTarget();
    return conversationActions(target?.muted ?? false, !!target?.otherUser?.handle);
  });

  /**
   * The people from the latest conversations, as rows under the recents:
   * the same list, and the same rows, as the new-message page.
   */
  readonly frequent = computed(() =>
    frequentContacts(
      this.store.conversations(),
      this.recents.entries().map((person) => person.id),
    ),
  );

  /**
   * Search is open and nothing is typed yet: the recents and frequent contacts, as
   * Messenger opens its search. With neither (a new account) the inbox stays,
   * which is still something to search through.
   */
  readonly showSearchStart = computed(
    () =>
      this.searchOpen() &&
      !this.people.query().trim() &&
      (this.recents.entries().length > 0 || this.frequent().length > 0),
  );

  /** `people.isEmpty` waits for the answer, so "no results" never shows over the skeleton. */
  readonly isSearchEmpty = computed(
    () => this.people.isEmpty() && this.store.visibleConversations().length === 0,
  );

  /** The first answer to a search is on its way and there is nothing yet to show. */
  readonly showPeopleSkeleton = computed(
    () => this.people.isSearching() && this.people.results().length === 0,
  );

  /** First load only. Once rows exist, a refresh happens under them. */
  readonly showSkeleton = computed(() => this.store.loading() && !this.store.hasLoaded());

  /** Nothing loaded and the last attempt failed — the only state that offers a retry. */
  readonly showLoadError = computed(() => this.store.loadFailed() && !this.store.hasLoaded());

  readonly isEmpty = computed(
    () =>
      this.store.hasLoaded() &&
      !this.people.isActive() &&
      this.store.conversations().length === 0,
  );

  /** Nothing matched the active filter, but the inbox itself is not empty. */
  readonly isFilteredEmpty = computed(
    () =>
      this.store.hasLoaded() &&
      !this.people.isActive() &&
      this.store.conversations().length > 0 &&
      this.store.visibleConversations().length === 0,
  );

  constructor() {
    addIcons(MESSAGING_ICONS);
  }

  // Not ngOnInit: Ionic keeps the page alive in the tab stack, so that would
  // run once per app session. The store dedups the extra calls.
  ionViewWillEnter(): void {
    this.store.loadConversations();
  }

  setFilter(value: InboxFilter): void {
    this.store.setFilter(value);
  }

  openSearch(): void {
    this.fold.arm();
    this.searchOpen.set(true);
  }

  closeSearch(): void {
    this.fold.arm();
    this.searchOpen.set(false);
    this.people.clear();
    this.store.setSearchQuery('');
    // Otherwise the field keeps focus, the keyboard stays up, and the next
    // tap on it fires no focus event to open search again.
    void this._searchbar()
      ?.getInputElement()
      .then((input) => input.blur());
  }

  onQueryChange(value: string): void {
    this.people.setQuery(value);
    // Conversation filtering is local, so it can track every keystroke — only
    // the people request needs the debounce.
    this.store.setSearchQuery(value);
  }

  openConversation(id: string): void {
    this.store.openConversation(id);
  }

  /**
   * A conversation from the search results. Only a direct one is remembered:
   * a recent is a person, and a group has no one person to show.
   */
  openSearchedConversation(conversation: ConversationListItem): void {
    if (conversation.otherUser) this.recents.push(recentFromPerson(conversation.otherUser));
    this.openConversation(conversation.id);
  }

  /**
   * A recent, a suggestion or a searched person: remembered, then the thread
   * with them reopened rather than a blank draft.
   */
  openRecent(person: RecentPerson): void {
    this.recents.push(person);
    this.closeSearch();
    const existing = this.store.findDirectWith(person.id);

    if (existing) {
      this.openConversation(existing.id);
      return;
    }

    void this._router.navigate(['/tabs/messages/new'], {
      queryParams: { to: person.id, name: person.name },
    });
  }

  removeRecent(person: RecentPerson): void {
    this.recents.remove(person.id);
  }

  clearRecents(): void {
    this.recents.clear();
  }

  openCompose(): void {
    void this._router.navigate(['/tabs/messages/compose']);
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    this.store.loadMoreConversations({ done: () => void event.target.complete() });
  }

  markRead(id: string): void {
    this.store.markReadOnEntry(id);
  }

  async markUnread(id: string): Promise<void> {
    const ok = await this.store.markUnread(id);
    if (!ok) {
      void this._feedbackService.error(
        null,
        this._translateService.instant('messages.toast.markUnreadFailed'),
      );
    }
  }

  openActions(conversation: ConversationListItem): void {
    this._actionTarget.set(conversation);
    this.actionsOpen.set(true);
  }

  /** The action sheet reports the choice once it has closed, so routing is safe. */
  onAction(action: ConversationAction): void {
    const target = this._actionTarget();
    if (!target) return;

    switch (action) {
      case ConversationActions.Profile: {
        const handle = target.otherUser?.handle;
        if (handle) void this._router.navigate(['/tabs/messages/person', handle]);
        break;
      }
      case ConversationActions.Mute:
        void this.toggleMute(target.id);
        break;
      case ConversationActions.Delete:
        this.deleteOpen.set(true);
        break;
      case ConversationActions.Block:
        this.blockOpen.set(true);
        break;
    }
  }

  /** Delete for me only; the store drops the row once the server agrees. */
  async deleteChat(): Promise<void> {
    const target = this._actionTarget();
    if (!target || this.deleting()) return;

    this.deleting.set(true);
    const ok = await this.store.deleteConversation(target.id);
    this.deleting.set(false);

    if (!ok) {
      void this._feedbackService.error(
        null,
        this._translateService.instant('messages.toast.deleteFailed'),
      );
      return;
    }
    this.deleteOpen.set(false);
    void this._feedbackService.success(this._translateService.instant('messages.toast.deleted'));
  }

  /** Same block as chat details; the store drops the row from the inbox itself. */
  async block(reason: UserBlockReason): Promise<void> {
    const target = this._actionTarget();
    const blockedId = target?.otherUser?.id;
    if (!target || !blockedId) return;

    const name = this.actionTitle();
    const ok = await this.store.blockUser({ blockedId, reason, conversationId: target.id });

    if (!ok) {
      void this._feedbackService.error(
        null,
        this._translateService.instant('messages.toast.blockFailed'),
      );
      return;
    }
    // Someone you blocked is not a shortcut back to them.
    this.recents.remove(blockedId);
    void this._feedbackService.success(
      this._translateService.instant('messages.toast.blocked', { name }),
    );
  }

  async toggleMute(id: string): Promise<void> {
    const wasMuted = this.store.conversations().find((c) => c.id === id)?.muted ?? false;
    const ok = await this.store.toggleMute(id);
    if (!ok) {
      void this._feedbackService.error(
        null,
        this._translateService.instant('messages.toast.muteFailed'),
      );
      return;
    }
    void this._feedbackService.success(
      this._translateService.instant(wasMuted ? 'messages.toast.unmuted' : 'messages.toast.muted'),
    );
  }

  retry(): void {
    this.store.loadConversations({ force: true });
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.loadConversations({ force: true, done: () => void event.target.complete() });
  }
}
