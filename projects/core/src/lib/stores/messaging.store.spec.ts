import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, throwError } from 'rxjs';
import { of } from 'rxjs';

import {
  MessagingStore,
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
});
