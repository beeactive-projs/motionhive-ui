import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MessagingStore, InboxFilter } from 'core';
import { ConversationRow } from '../conversation-row/conversation-row';
import { InboxFilters } from '../inbox-filters/inbox-filters';
import { InboxSearchBar } from '../inbox-search-bar/inbox-search-bar';

/**
 * Conversation list container — left column of the inbox.
 *
 * Wires the store's `visibleConversations` + `filter` + `searchQuery`
 * to the search bar, filter chips, and the scrollable row list. Owns
 * none of its own state — pure projection of the store.
 *
 * Active-row styling is driven by `store.activeId()` (set by the URL
 * route param in F3 + by the row click below).
 */
@Component({
  selector: 'mh-conversation-list',
  standalone: true,
  imports: [ConversationRow, InboxFilters, InboxSearchBar],
  templateUrl: './conversation-list.html',
  styleUrl: './conversation-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationList {
  protected readonly store = inject(MessagingStore);

  protected readonly visible = this.store.visibleConversations;
  protected readonly counts = this.store.filterCounts;

  /**
   * Show a "nothing matched your search" message instead of an empty
   * panel when the user has typed a query but the filter returns 0.
   * Differs from the initial "no conversations yet" state, which only
   * applies when the user truly has no conversations.
   */
  protected readonly noResults = computed(
    () =>
      this.store.hasLoaded() &&
      this.visible().length === 0 &&
      (this.store.searchQuery().length > 0 ||
        this.store.filter() !== 'all'),
  );

  protected readonly noConversationsAtAll = computed(
    () =>
      this.store.hasLoaded() &&
      this.store.conversations().length === 0,
  );

  protected onFilterChange(filter: InboxFilter): void {
    this.store.setFilter(filter);
  }

  protected onSearchChange(query: string): void {
    this.store.setSearchQuery(query);
  }

  protected onRowSelect(conversationId: string): void {
    this.store.openConversation(conversationId);
  }
}
