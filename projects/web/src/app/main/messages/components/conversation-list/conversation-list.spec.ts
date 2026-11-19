import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { MessagingStore } from 'core';

import { ConversationList } from './conversation-list';

function setup() {
  const loadMoreConversations = vi.fn();
  TestBed.overrideComponent(ConversationList, { set: { template: '', imports: [] } });
  TestBed.configureTestingModule({
    providers: [
      {
        provide: MessagingStore,
        useValue: {
          visibleConversations: signal([]),
          filterCounts: signal({ all: 0, unread: 0 }),
          hasLoaded: signal(true),
          conversations: signal([]),
          searchQuery: signal(''),
          filter: signal('all'),
          loadMoreConversations,
        },
      },
    ],
  });
  const list = TestBed.createComponent(ConversationList).componentInstance as unknown as {
    onScroll(event: Event): void;
  };
  const scrolled = (scrollTop: number) =>
    ({ target: { scrollHeight: 2000, clientHeight: 600, scrollTop } }) as unknown as Event;
  return { list, loadMoreConversations, scrolled };
}

describe('ConversationList, paging', () => {
  it('asks for the next page near the end of the list, not before', () => {
    const { list, loadMoreConversations, scrolled } = setup();

    list.onScroll(scrolled(500));
    expect(loadMoreConversations).not.toHaveBeenCalled();

    list.onScroll(scrolled(1300));
    expect(loadMoreConversations).toHaveBeenCalledOnce();
  });
});
