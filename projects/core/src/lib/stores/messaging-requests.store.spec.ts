import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';

import { MessagingStore } from './messaging.store';
import { AuthStore } from './auth.store';
import { MessagingService } from '../services/messaging/messaging.service';
import { MessagingRealtimeService } from '../services/messaging/messaging-realtime.service';
import { ConversationListItem, MessagingStreamEnvelope } from '../models/messaging';

const ME = 'me-1';

function row(id: string, patch: Partial<ConversationListItem> = {}): ConversationListItem {
  return {
    id,
    type: 'DIRECT',
    name: null,
    avatarUrl: null,
    lastMessageAt: '2026-11-20T10:00:00Z',
    lastMessagePreview: 'hi',
    unreadCount: 0,
    muted: false,
    otherUser: { id: `user-${id}`, firstName: 'Ana', lastName: 'Pop', avatarUrl: null, handle: null },
    lastReadByOther: null,
    ...patch,
  };
}

/** The rows the mocked API lists; each test starts from a fresh set. */
const current: { inbox: ConversationListItem[] } = { inbox: [] };

function makeApi() {
  return {
      listConversations: vi.fn(() => of({ items: current.inbox, total: current.inbox.length })),
      getConversation: vi.fn(() => of(row('new'))),
      listMessages: vi.fn(() => of({ items: [], nextBefore: null })),
      ackStreamEvent: vi.fn(() => of(undefined)),
      markRead: vi.fn(() => of({ lastReadAt: '2026-11-20T10:00:00Z' })),
      acceptRequest: vi.fn(() => of(row('request', { isRequest: false }))),
      declineRequest: vi.fn(() => of({ declinedAt: '2026-11-20T10:00:00Z' })),
      setArchived: vi.fn(() => of({ archived: true })),
      reach: vi.fn(() => of({ status: 'REQUEST', requestLimit: 3 })),
      shareTo: vi.fn(() =>
        of({
          results: [
            { recipientId: 'u-1', status: 'SENT', conversationId: 'chat', reason: null },
            { recipientId: 'u-2', status: 'REFUSED', conversationId: null, reason: 'x' },
          ],
        }),
      ),
      getMessage: vi.fn(() =>
        of({
          id: 'm-share',
          conversationId: 'chat',
          senderId: 'user-chat',
          kind: 'TEXT',
          body: 'Morning yoga flow',
          caption: '',
          attachments: [{ type: 'SESSION', id: 's-1', card: { type: 'SESSION', state: 'AVAILABLE' } }],
          deletedAt: null,
          createdAt: '2026-11-20T10:05:00Z',
        }),
      ),
      sendMessage: vi.fn(),
    };
}

/** Message requests, archive and sharing (API migrations 090 and 092). */
describe('MessagingStore — requests, archive, sharing', () => {
  let store: MessagingStore;
  let events$: Subject<MessagingStreamEnvelope>;
  let inbox: ConversationListItem[];
  let api: ReturnType<typeof makeApi>;

  function emit(event: MessagingStreamEnvelope['event']): void {
    events$.next({ id: `e-${Math.random()}`, event });
  }

  beforeEach(() => {
    inbox = [
      row('chat', { unreadCount: 2 }),
      row('request', { isRequest: true, unreadCount: 1 }),
      row('archived', { archived: true, unreadCount: 4 }),
    ];
    current.inbox = inbox;
    events$ = new Subject();
    api = makeApi();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        MessagingStore,
        { provide: MessagingService, useValue: api },
        {
          provide: MessagingRealtimeService,
          useValue: {
            events$,
            status: signal('open').asReadonly(),
            lastEventId: signal<string | null>(null),
            connect: vi.fn(),
            disconnect: vi.fn(),
            reconnect: vi.fn(),
          },
        },
        {
          provide: AuthStore,
          useValue: {
            user: signal({ id: ME }).asReadonly(),
            isAuthenticated: signal(true).asReadonly(),
          },
        },
        { provide: Router, useValue: { navigate: vi.fn(() => Promise.resolve(true)) } },
      ],
    });
    store = TestBed.inject(MessagingStore);
    TestBed.tick();
    store.loadConversations({ force: true });
  });

  it('splits the list into chats, requests and archived, and counts only chats', () => {
    expect(store.chatConversations().map((c) => c.id)).toEqual(['chat']);
    expect(store.requestConversations().map((c) => c.id)).toEqual(['request']);
    expect(store.archivedConversations().map((c) => c.id)).toEqual(['archived']);
    expect(store.chatsUnreadTotal()).toBe(2);
    // Web's count is unchanged: it still lists everything.
    expect(store.unreadTotal()).toBe(7);
  });

  it('fetches a folder and adds the rows past the loaded pages', () => {
    const far = row('far-request', { isRequest: true });
    api.listConversations.mockReturnValueOnce(of({ items: [inbox[1], far], total: 2 }));

    store.loadFolder('requests');

    expect(api.listConversations).toHaveBeenLastCalledWith(1, 50, 'requests');
    expect(store.requestConversations().map((c) => c.id)).toContain('far-request');
    expect(store.folderLoaded('requests')).toBe(true);
  });

  it('drops a request the folder no longer holds (accepted or deleted elsewhere)', () => {
    api.listConversations.mockReturnValueOnce(of({ items: [], total: 0 }));

    store.loadFolder('requests');

    expect(store.requestConversations()).toEqual([]);
    expect(store.chatConversations().map((c) => c.id)).toEqual(['chat']);
  });

  it('accepting moves the request into the chats', async () => {
    expect(await store.acceptRequest('request')).toBe(true);
    expect(store.chatConversations().map((c) => c.id)).toContain('request');
  });

  it('deleting a request forgets it', async () => {
    expect(await store.declineRequest('request')).toBe(true);
    expect(store.conversations().some((c) => c.id === 'request')).toBe(false);
  });

  it('archives at once, and moves back when the server refuses', async () => {
    api.setArchived.mockReturnValueOnce(throwError(() => new Error('down')));

    const done = store.setArchived('chat', true);
    expect(await done).toBe(false);
    expect(store.chatConversations().map((c) => c.id)).toEqual(['chat']);

    expect(await store.setArchived('chat', true)).toBe(true);
    expect(store.archivedConversations().map((c) => c.id)).toContain('chat');
  });

  it('applies accepted, archived and declined events', () => {
    emit({ type: 'conversation.accepted', payload: { conversationId: 'request', userId: ME, acceptedAt: 'x' } });
    expect(store.requestConversations()).toEqual([]);

    store['patchConversation']('chat', { waiting: { remaining: 1 } });
    emit({ type: 'conversation.accepted', payload: { conversationId: 'chat', userId: 'them', acceptedAt: 'x' } });
    expect(store.conversations().find((c) => c.id === 'chat')?.waiting).toBeNull();

    emit({ type: 'conversation.archived', payload: { conversationId: 'chat', userId: ME, archived: true } });
    expect(store.archivedConversations().map((c) => c.id)).toContain('chat');

    emit({ type: 'conversation.declined', payload: { conversationId: 'archived', userId: ME } });
    expect(store.conversations().some((c) => c.id === 'archived')).toBe(false);
  });

  it('announces messages from others, keeps an archived chat archived, and reads a share again for its card', () => {
    emit({
      type: 'message.created',
      payload: {
        conversationId: 'archived',
        message: { id: 'm-1', senderId: 'them', body: 'hello', kind: 'TEXT', createdAt: '2026-11-20T10:01:00Z' },
      },
    });
    expect(store.incoming()?.conversationId).toBe('archived');
    expect(store.conversations().find((c) => c.id === 'archived')?.archived).toBe(true);

    store.loadMessages('chat');
    emit({
      type: 'message.created',
      payload: {
        conversationId: 'chat',
        message: {
          id: 'm-share',
          senderId: 'user-chat',
          body: 'Morning yoga flow',
          kind: 'TEXT',
          createdAt: '2026-11-20T10:05:00Z',
          attachments: [{ type: 'SESSION', id: 's-1' }],
        },
      },
    });
    expect(api.getMessage).toHaveBeenCalledWith('m-share');
    const shared = store.messagesFor('chat').items.find((m) => m.id === 'm-share');
    expect(shared?.attachments?.[0]?.type).toBe('SESSION');
    expect(store.conversations()[0].lastMessageAttachmentType).toBe('SESSION');
  });

  it('a message of my own unarchives the chat and announces nothing', () => {
    emit({
      type: 'message.created',
      payload: {
        conversationId: 'archived',
        message: { id: 'm-2', senderId: ME, body: 'back', kind: 'TEXT', createdAt: '2026-11-20T10:02:00Z' },
      },
    });
    expect(store.incoming()).toBeNull();
    expect(store.conversations().find((c) => c.id === 'archived')?.archived).toBe(false);
  });

  it('sharing reads the list again and marks the touched threads stale', async () => {
    store.loadMessages('chat');
    const calls = api.listConversations.mock.calls.length;

    const results = await store.shareTo(['u-1', 'u-2'], { type: 'SESSION', id: 's-1' }, 'Join?');

    expect(api.shareTo).toHaveBeenCalledWith(['u-1', 'u-2'], { type: 'SESSION', id: 's-1' }, 'Join?');
    expect(results?.map((r) => r.status)).toEqual(['SENT', 'REFUSED']);
    expect(store.messagesFor('chat').stale).toBe(true);
    expect(api.listConversations.mock.calls.length).toBe(calls + 1);
  });

  it('a daily cap refusal shows the server sentence and pauses nothing', async () => {
    api.sendMessage.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 429,
            error: { message: "You've started a lot of new conversations today." },
          }),
      ),
    );

    await store.sendMessage({ conversationId: 'chat', recipientId: 'user-chat', body: 'hey' });

    expect(store.sendError()).toBe("You've started a lot of new conversations today.");
    expect(store.sendRateLimitedUntil()).toBeNull();
  });
});
