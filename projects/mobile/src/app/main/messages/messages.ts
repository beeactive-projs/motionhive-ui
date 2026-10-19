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
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSkeletonText,
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
  UserSearchResult,
  displayName,
} from 'core';

import { ActionSheet } from '../../_shared/components/action-sheet/action-sheet';
import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../_shared/services/feedback.service';
import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { AvatarTone, avatarToneFor } from '../../_shared/utils/avatar-tone.utils';
import { injectPeopleSearch } from '../../_shared/utils/people-search';
import { ConversationRow } from './_components/conversation-row/conversation-row';
import { BlockUserSheet } from './_sheets/block-user-sheet/block-user-sheet';
import { NewMessageSheet } from './_sheets/new-message-sheet/new-message-sheet';
import {
  ConversationAction,
  ConversationActions,
  MESSAGING_ICONS,
  conversationActions,
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
 * store, already in memory; people come from `/users/search`, which is how a
 * first message to someone new gets started.
 */
@Component({
  selector: 'mh-messages',
  imports: [
    ActionSheet,
    BlockUserSheet,
    ConversationRow,
    EmptyState,
    HexAvatar,
    IonButton,
    IonButtons,
    IonContent,
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
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    NewMessageSheet,
    NotificationBell,
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

  /** Focusing the search field folds the title and the pills away. */
  readonly searchOpen = signal(false);

  /** The row whose More was tapped; the More and block sheets act on it. */
  private readonly _actionTarget = signal<ConversationListItem | null>(null);
  readonly actionsOpen = signal(false);
  readonly blockOpen = signal(false);

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

  readonly isSearchEmpty = computed(
    () =>
      this.people.isActive() &&
      this.people.results().length === 0 &&
      this.store.visibleConversations().length === 0,
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

  /**
   * Rows on screen (the inbox, its skeleton or search results): the page
   * takes the list's white. Empty and error states keep the slate.
   */
  readonly showList = computed(
    () =>
      this.showSkeleton() ||
      (this.people.isActive()
        ? !this.isSearchEmpty()
        : !this.showLoadError() && !this.isEmpty() && !this.isFilteredEmpty()),
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
    this.searchOpen.set(true);
  }

  closeSearch(): void {
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

  /** Reopen an existing thread with this person rather than a blank draft. */
  openPerson(person: UserSearchResult): void {
    this.closeSearch();
    const existing = this.store.findDirectWith(person.id);

    if (existing) {
      this.openConversation(existing.id);
      return;
    }

    void this._router.navigate(['/tabs/messages/new'], {
      queryParams: { to: person.id, name: this.nameOf(person) },
    });
  }

  openCompose(): void {
    this.store.enterComposeMode();
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
      case ConversationActions.Block:
        this.blockOpen.set(true);
        break;
    }
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

  nameOf(person: UserSearchResult): string {
    return displayName(person);
  }

  toneFor(id: string): AvatarTone {
    return avatarToneFor(id);
  }
}
