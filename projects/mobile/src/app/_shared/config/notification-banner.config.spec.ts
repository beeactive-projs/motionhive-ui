import { describe, expect, it } from 'vitest';

import { ConversationListItem, IncomingMessage } from 'core';

import { messageBanner } from './notification-banner.config';

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

const incoming: IncomingMessage = {
  conversationId: 'c-1',
  messageId: 'm-1',
  preview: 'See you at 7?',
  isRequest: false,
  at: 0,
};

function conversation(patch: Partial<ConversationListItem> = {}): ConversationListItem {
  return {
    id: 'c-1',
    type: 'DIRECT',
    name: null,
    avatarUrl: null,
    lastMessageAt: null,
    lastMessagePreview: null,
    unreadCount: 1,
    muted: false,
    otherUser: { id: 'u-1', firstName: 'Ana', lastName: 'Pop', avatarUrl: 'a.jpg', handle: null },
    lastReadByOther: null,
    ...patch,
  };
}

describe('messageBanner', () => {
  it('shows the sender and the first line, and opens their chat', () => {
    expect(messageBanner(incoming, conversation(), t)).toMatchObject({
      title: 'Ana Pop',
      detail: 'See you at 7?',
      imageUrl: 'a.jpg',
      conversationId: 'c-1',
    });
  });

  it('a request names the sender and shows none of their words', () => {
    const view = messageBanner({ ...incoming, isRequest: true }, conversation(), t);
    expect(view?.title).toBe('messages.banner.request:{"name":"Ana Pop"}');
    expect(view?.detail).toBe('messages.banner.requestDetail');
  });

  it('stays quiet for a muted or archived chat', () => {
    expect(messageBanner(incoming, conversation({ muted: true }), t)).toBeNull();
    expect(messageBanner(incoming, conversation({ archived: true }), t)).toBeNull();
  });
});
