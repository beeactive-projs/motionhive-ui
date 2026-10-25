import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, throwError } from 'rxjs';
import { of } from 'rxjs';

import {
  MessagingStore,
  isOptimisticMessageId,
  isPendingThreadKey,
  pendingThreadKey,
} from './messaging.store';
import { AuthStore } from './auth.store';
import { MessagingService } from '../services/messaging/messaging.service';
import { MessagingRealtimeService } from '../services/messaging/messaging-realtime.service';

const ME = 'me-1';
const RECIPIENT = 'them-1';
const REAL_CONV = 'conv-real';

function sendResult(overrides: Record<string, unknown> = {}) {
  return {
    message: {
      id: 'msg-server',
      conversationId: REAL_CONV,
      senderId: ME,
      kind: 'TEXT',
      body: 'hello',
      deletedAt: null,
      createdAt: '2026-05-11T10:00:00Z',
    },
    conversation: {
      id: REAL_CONV,
      type: 'DIRECT',
      name: null,
      avatarUrl: null,
      lastMessageAt: '2026-05-11T10:00:00Z',
      lastMessagePreview: 'hello',
      unreadCount: 0,
      muted: false,
      otherUser: {
        id: RECIPIENT,
        firstName: 'Bob',
        lastName: 'Builder',
        avatarUrl: null,
        handle: null,
      },
      lastReadByOther: null,
    },
    delivered: true,
    threatFlags: { anyFlag: false },
    ...overrides,
  };
}

describe('MessagingStore — first-message (pending) thread', () => {
  let store: MessagingStore;
  let api: {
    sendMessage: ReturnType<typeof vi.fn>;
    listMessages: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      sendMessage: vi.fn(() => of(sendResult())),
      listMessages: vi.fn(() => of({ items: [], nextBefore: null })),
      markRead: vi.fn(() => of({ lastReadAt: '2026-05-11T10:00:00Z' })),
    };
    router = { navigate: vi.fn(() => Promise.resolve(true)) };

    const user = signal<{ id: string } | null>({ id: ME });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        MessagingStore,
        { provide: MessagingService, useValue: api },
        {
          provide: MessagingRealtimeService,
          useValue: {
            events$: new Subject(),
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
            user: user.asReadonly(),
            isAuthenticated: signal(true).asReadonly(),
          },
        },
        { provide: Router, useValue: router },
      ],
    });
    store = TestBed.inject(MessagingStore);
  });

  it('keys a pending thread on its recipient', () => {
    expect(isPendingThreadKey(pendingThreadKey(RECIPIENT))).toBe(true);
    expect(isPendingThreadKey(REAL_CONV)).toBe(false);
    expect(isPendingThreadKey(null)).toBe(false);
  });

  it('shows a first message before the server answers', () => {
    // Never resolves: the bubble must not be waiting on it.
    api.sendMessage.mockReturnValue(new Subject());

    void store.sendMessage({
      conversationId: null,
      recipientId: RECIPIENT,
      body: 'hello',
    });

    const pending = store.pendingMessagesFor(RECIPIENT).items;
    expect(pending).toHaveLength(1);
    expect(pending[0].body).toBe('hello');
    expect(pending[0].senderId).toBe(ME);
  });

  it('hands the message to the real conversation and clears the pending thread', async () => {
    const resolved = await store.sendMessage({
      conversationId: null,
      recipientId: RECIPIENT,
      body: 'hello',
    });

    expect(resolved).toBe(REAL_CONV);
    expect(store.pendingMessagesFor(RECIPIENT).items).toEqual([]);

    const thread = store.messagesFor(REAL_CONV).items;
    expect(thread).toHaveLength(1);
    expect(thread[0].id).toBe('msg-server');
    // Seeded, so opening the thread does not refetch what we just sent.
    expect(store.messagesFor(REAL_CONV).hasLoaded).toBe(true);
  });

  it('takes the bubble back when the send fails', async () => {
    api.sendMessage.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 403, error: { message: 'Nope.' } }),
      ),
    );

    await store.sendMessage({
      conversationId: null,
      recipientId: RECIPIENT,
      body: 'hello',
    });

    expect(store.pendingMessagesFor(RECIPIENT).items).toEqual([]);
    expect(store.sendError()).toBe('Nope.');
  });

  it('drops the pending thread when the recipient never receives it', async () => {
    api.sendMessage.mockReturnValue(of(sendResult({ delivered: false })));

    await store.sendMessage({
      conversationId: null,
      recipientId: RECIPIENT,
      body: 'hello',
    });

    expect(store.pendingMessagesFor(RECIPIENT).items).toEqual([]);
    expect(store.composeMode()).toBe(false);
  });

  it('never asks the server about a thread that exists only on this client', () => {
    const key = pendingThreadKey(RECIPIENT);

    store.loadMessages(key);
    store.loadOlderMessages(key);
    store.markReadOnEntry(key);

    expect(api.listMessages).not.toHaveBeenCalled();
    expect(api.markRead).not.toHaveBeenCalled();
  });

  it('still inserts optimistically into an open thread', async () => {
    api.sendMessage.mockReturnValue(new Subject());

    void store.sendMessage({
      conversationId: REAL_CONV,
      recipientId: RECIPIENT,
      body: 'second',
    });

    const items = store.messagesFor(REAL_CONV).items;
    expect(items).toHaveLength(1);
    expect(items[0].body).toBe('second');
    // An open thread is not a pending one.
    expect(store.pendingMessagesFor(RECIPIENT).items).toEqual([]);
  });

  it('replaces the optimistic bubble in an open thread with the server row', async () => {
    await store.sendMessage({
      conversationId: REAL_CONV,
      recipientId: RECIPIENT,
      body: 'hello',
    });

    const items = store.messagesFor(REAL_CONV).items;
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('msg-server');
  });

  // ─── the composer must not wait on the network ───────────────────

  it('empties the draft on the keystroke, not on the response', () => {
    api.sendMessage.mockReturnValue(new Subject());
    store.saveDraft(REAL_CONV, 'hello');

    void store.sendMessage({
      conversationId: REAL_CONV,
      recipientId: RECIPIENT,
      body: 'hello',
    });

    // The composers mirror this draft into their input. Leaving it set
    // until the server answered wrote the text straight back after they
    // cleared it, so it sat there for the whole round trip.
    expect(store.draftFor(REAL_CONV)).toBe('');
  });

  it('empties the picker draft too when there is no conversation yet', () => {
    api.sendMessage.mockReturnValue(new Subject());
    store.saveDraft(null, 'hello');

    void store.sendMessage({
      conversationId: null,
      recipientId: RECIPIENT,
      body: 'hello',
    });

    expect(store.draftFor(null)).toBe('');
  });

  it('gives the text back when the send fails', async () => {
    api.sendMessage.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 403, error: { message: 'Nope.' } }),
      ),
    );

    await store.sendMessage({
      conversationId: REAL_CONV,
      recipientId: RECIPIENT,
      body: 'hello',
    });

    expect(store.draftFor(REAL_CONV)).toBe('hello');
  });

  it('marks an unacknowledged message so the bubble can show the wait', () => {
    api.sendMessage.mockReturnValue(new Subject());

    void store.sendMessage({
      conversationId: REAL_CONV,
      recipientId: RECIPIENT,
      body: 'hello',
    });

    expect(isOptimisticMessageId(store.messagesFor(REAL_CONV).items[0].id)).toBe(
      true,
    );
    expect(isOptimisticMessageId('msg-server')).toBe(false);
  });

  it('keeps a second message typed while the first is still in flight', async () => {
    // First send resolves on demand; the second is fired before it does.
    const first = new Subject<ReturnType<typeof sendResult>>();
    api.sendMessage.mockReturnValueOnce(first);

    void store.sendMessage({
      conversationId: null,
      recipientId: RECIPIENT,
      body: 'one',
    });
    api.sendMessage.mockReturnValue(new Subject());
    void store.sendMessage({
      conversationId: null,
      recipientId: RECIPIENT,
      body: 'two',
    });

    expect(store.pendingMessagesFor(RECIPIENT).items).toHaveLength(2);

    first.next(sendResult());
    first.complete();
    await Promise.resolve();

    // The pending thread is handed over, and the still-unsent second
    // message travels with it rather than vanishing.
    const thread = store.messagesFor(REAL_CONV).items;
    expect(thread.map((m) => m.body)).toEqual(['hello', 'two']);
    expect(store.pendingMessagesFor(RECIPIENT).items).toEqual([]);
  });
});

describe('MessagingStore — mark as unread', () => {
  const READ_CONV = 'conv-read';
  const UNREAD_CONV = 'conv-unread';

  let store: MessagingStore;
  let events$: Subject<unknown>;
  let api: {
    listConversations: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
    markUnread: ReturnType<typeof vi.fn>;
    ackStreamEvent: ReturnType<typeof vi.fn>;
  };

  function row(id: string, unreadCount: number) {
    return { ...sendResult().conversation, id, unreadCount };
  }

  beforeEach(() => {
    events$ = new Subject();
    api = {
      listConversations: vi.fn(() =>
        of({ items: [row(READ_CONV, 0), row(UNREAD_CONV, 3)], total: 2 }),
      ),
      markRead: vi.fn(() => of({ lastReadAt: '2026-05-11T10:00:00Z' })),
      markUnread: vi.fn(() => of({ markedUnread: true })),
      ackStreamEvent: vi.fn(() => of(undefined)),
    };

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
            // Signed out, so the auth effect doesn't load on its own.
            isAuthenticated: signal(false).asReadonly(),
          },
        },
        { provide: Router, useValue: { navigate: vi.fn(() => Promise.resolve(true)) } },
      ],
    });
    store = TestBed.inject(MessagingStore);
    store.loadConversations({ force: true });
  });

  it('counts a marked row as unread without inventing messages', async () => {
    expect(await store.markUnread(READ_CONV)).toBe(true);

    expect(api.markUnread).toHaveBeenCalledWith(READ_CONV);
    expect(store.filterCounts().unread).toBe(2);
    // 3 real unread messages + 1 for the marked thread, like the BE badge.
    expect(store.unreadTotal()).toBe(4);

    store.setFilter('unread');
    expect(store.visibleConversations().map((c) => c.id)).toEqual([READ_CONV, UNREAD_CONV]);
  });

  it('takes the mark back when the server refuses it', async () => {
    api.markUnread.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    expect(await store.markUnread(READ_CONV)).toBe(false);
    expect(store.filterCounts().unread).toBe(1);
  });

  it('opening the thread clears the mark', async () => {
    await store.markUnread(READ_CONV);

    store.markReadOnEntry(READ_CONV);

    expect(store.filterCounts().unread).toBe(1);
    expect(store.conversations().find((c) => c.id === READ_CONV)?.markedUnread).toBe(false);
  });

  it('follows a mark set or cleared on another device', () => {
    events$.next({
      id: 'evt-1',
      event: {
        type: 'conversation.unread',
        payload: { conversationId: READ_CONV, userId: ME, markedUnread: true },
      },
    });
    expect(store.filterCounts().unread).toBe(2);

    events$.next({
      id: 'evt-2',
      event: {
        type: 'conversation.unread',
        payload: { conversationId: READ_CONV, userId: ME, markedUnread: false },
      },
    });
    expect(store.filterCounts().unread).toBe(1);
  });

  it("ignores someone else's mark", () => {
    events$.next({
      id: 'evt-1',
      event: {
        type: 'conversation.unread',
        payload: { conversationId: READ_CONV, userId: 'someone-else', markedUnread: true },
      },
    });
    expect(store.filterCounts().unread).toBe(1);
  });
});

describe('MessagingStore — delete chat', () => {
  const KEEP = 'conv-keep';
  const GONE = 'conv-gone';

  let store: MessagingStore;
  let events$: Subject<unknown>;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let api: {
    listConversations: ReturnType<typeof vi.fn>;
    clearConversation: ReturnType<typeof vi.fn>;
    listMessages: ReturnType<typeof vi.fn>;
    ackStreamEvent: ReturnType<typeof vi.fn>;
  };

  function row(id: string, unreadCount: number) {
    return { ...sendResult().conversation, id, unreadCount };
  }

  beforeEach(() => {
    events$ = new Subject();
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    api = {
      listConversations: vi.fn(() =>
        of({ items: [row(KEEP, 0), row(GONE, 2)], total: 2 }),
      ),
      clearConversation: vi.fn(() => of({ clearedAt: '2026-10-25T10:00:00Z' })),
      listMessages: vi.fn(() => of({ items: [], nextBefore: null })),
      ackStreamEvent: vi.fn(() => of(undefined)),
    };

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
            isAuthenticated: signal(false).asReadonly(),
          },
        },
        { provide: Router, useValue: router },
      ],
    });
    store = TestBed.inject(MessagingStore);
    store.loadConversations({ force: true });
  });

  it('drops the row, and its unread with it, once the server agrees', async () => {
    expect(await store.deleteConversation(GONE)).toBe(true);

    expect(api.clearConversation).toHaveBeenCalledWith(GONE);
    expect(store.conversations().map((c) => c.id)).toEqual([KEEP]);
    expect(store.unreadTotal()).toBe(0);
  });

  it('keeps the row when the server refuses', async () => {
    api.clearConversation.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    expect(await store.deleteConversation(GONE)).toBe(false);
    expect(store.conversations().map((c) => c.id)).toEqual([KEEP, GONE]);
  });

  it('leaves the thread when it is the one on screen', async () => {
    store.openConversation(GONE);
    router.navigate.mockClear();

    await store.deleteConversation(GONE);

    expect(store.activeId()).toBeNull();
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it('follows a delete made on another device', () => {
    events$.next({
      id: 'evt-1',
      event: {
        type: 'conversation.cleared',
        payload: { conversationId: GONE, userId: ME, clearedAt: '2026-10-25T10:00:00Z' },
      },
    });
    expect(store.conversations().map((c) => c.id)).toEqual([KEEP]);
  });

  it("ignores someone else's delete", () => {
    events$.next({
      id: 'evt-1',
      event: {
        type: 'conversation.cleared',
        payload: { conversationId: GONE, userId: 'someone-else', clearedAt: '2026-10-25T10:00:00Z' },
      },
    });
    expect(store.conversations()).toHaveLength(2);
  });
});

describe('MessagingStore — catching up after the background', () => {
  let store: MessagingStore;
  let realtime: { reconnect: ReturnType<typeof vi.fn> };
  let api: {
    listConversations: ReturnType<typeof vi.fn>;
    listMessages: ReturnType<typeof vi.fn>;
  };
  let authed: WritableSignal<boolean>;

  function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));

    realtime = { reconnect: vi.fn() };
    api = {
      listConversations: vi.fn(() => of({ items: [], total: 0 })),
      listMessages: vi.fn(() => of({ items: [], nextBefore: null })),
    };
    authed = signal(true);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        MessagingStore,
        { provide: MessagingService, useValue: api },
        {
          provide: MessagingRealtimeService,
          useValue: {
            events$: new Subject(),
            status: signal('open').asReadonly(),
            lastEventId: signal<string | null>(null),
            connect: vi.fn(),
            disconnect: vi.fn(),
            ...realtime,
          },
        },
        {
          provide: AuthStore,
          useValue: {
            user: signal({ id: ME }).asReadonly(),
            isAuthenticated: authed.asReadonly(),
          },
        },
        { provide: Router, useValue: { navigate: vi.fn(() => Promise.resolve(true)) } },
      ],
    });
    store = TestBed.inject(MessagingStore);
  });

  afterEach(() => {
    setVisibility('visible');
    vi.useRealTimers();
  });

  it('opens a fresh stream and re-reads the inbox and the open thread', () => {
    store.setActiveId(REAL_CONV);

    store.resync();

    expect(realtime.reconnect).toHaveBeenCalledTimes(1);
    expect(api.listConversations).toHaveBeenCalledTimes(1);
    expect(api.listMessages).toHaveBeenCalledWith(REAL_CONV, expect.anything());
  });

  it('re-reads a cached thread on its next open, since it missed the same messages', () => {
    store.loadMessages(REAL_CONV);
    expect(api.listMessages).toHaveBeenCalledTimes(1);

    // Back on the inbox when the app went to the background.
    store.setActiveId(null);
    store.resync();
    expect(api.listMessages).toHaveBeenCalledTimes(1);

    store.loadMessages(REAL_CONV);
    expect(api.listMessages).toHaveBeenCalledTimes(2);

    // Fresh again: a second open trusts the cache.
    store.loadMessages(REAL_CONV);
    expect(api.listMessages).toHaveBeenCalledTimes(2);
  });

  it('treats the second resume signal of one return as the same return', () => {
    store.resync();
    vi.advanceTimersByTime(1_000);
    store.resync();
    expect(realtime.reconnect).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_000);
    store.resync();
    expect(realtime.reconnect).toHaveBeenCalledTimes(2);
  });

  it('does nothing when signed out', () => {
    authed.set(false);
    store.resync();
    expect(realtime.reconnect).not.toHaveBeenCalled();
    expect(api.listConversations).not.toHaveBeenCalled();
  });

  it('catches up when the page comes back after a real absence, not a glance', () => {
    setVisibility('hidden');
    vi.advanceTimersByTime(5_000);
    setVisibility('visible');
    expect(realtime.reconnect).not.toHaveBeenCalled();

    setVisibility('hidden');
    vi.advanceTimersByTime(60_000);
    setVisibility('visible');
    expect(realtime.reconnect).toHaveBeenCalledTimes(1);
  });
});
