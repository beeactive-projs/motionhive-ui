import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
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
  SegmentCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { InboxFilter, MessagingStore, UserSearchResult, displayName } from 'core';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { AvatarTone, avatarToneFor } from '../../_shared/utils/avatar-tone.utils';
import { injectPeopleSearch } from '../../_shared/utils/people-search';
import { ConversationRow } from './_components/conversation-row/conversation-row';
import { NewMessageSheet } from './_sheets/new-message-sheet/new-message-sheet';
import { MESSAGING_ICONS } from './messages.config';

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
    ConversationRow,
    EmptyState,
    HexAvatar,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
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
    NewMessageSheet,
  ],
  templateUrl: './messages.html',
  styleUrl: './messages.scss',
})
export class Messages implements ViewWillEnter {
  readonly store = inject(MessagingStore);
  private readonly _router = inject(Router);

  readonly people = injectPeopleSearch();

  /**
   * The subset of `InboxFilter` this app offers — the store also knows
   * 'groups' and 'coaches', which have no screen behind them yet. Narrower
   * than `InboxFilter` on purpose: these are the keys `filterCounts` returns.
   */
  readonly filters = [
    { value: 'all', label: 'All' },
    { value: 'unread', label: 'Unread' },
  ] as const satisfies readonly { value: InboxFilter; label: string }[];

  readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7, 8];

  /** Search takes over the toolbar rather than stacking under it. */
  readonly searchOpen = signal(false);

  readonly isSearchEmpty = computed(
    () =>
      this.people.isActive() &&
      this.people.results().length === 0 &&
      this.store.visibleConversations().length === 0,
  );

  /** First load only. Once rows exist, a refresh happens under them. */
  readonly showSkeleton = computed(() => this.store.loading() && !this.store.hasLoaded());

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

  /** The plain conversation list — the one state that gets a white surface. */
  readonly showFlatList = computed(
    () =>
      this.showSkeleton() ||
      (!this.people.isActive() && !this.isEmpty() && !this.isFilteredEmpty()),
  );

  constructor() {
    addIcons(MESSAGING_ICONS);
  }

  // Not ngOnInit: Ionic keeps the page alive in the tab stack, so that would
  // run once per app session. The store dedups the extra calls.
  ionViewWillEnter(): void {
    this.store.loadConversations();
  }

  onFilterChange(event: SegmentCustomEvent): void {
    const value = event.detail.value;
    if (typeof value === 'string') this.store.setFilter(value as InboxFilter);
  }

  openSearch(): void {
    this.searchOpen.set(true);
  }

  closeSearch(): void {
    this.searchOpen.set(false);
    this.people.clear();
    this.store.setSearchQuery('');
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
