import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { MessagingStore, UserService } from 'core';

import { FeedbackService } from '../../services/feedback.service';
import { SendToService } from '../../services/send-to.service';
import { SendToSheet } from './send-to-sheet';

describe('SendToSheet', () => {
  function setup(results: unknown) {
    const shareTo = vi.fn(() => Promise.resolve(results));
    const success = vi.fn();
    const error = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        SendToService,
        {
          provide: MessagingStore,
          useValue: {
            shareTo,
            chatConversations: signal([
              {
                id: 'c-1',
                otherUser: { id: 'u-1', firstName: 'Ana', lastName: 'Pop', avatarUrl: null, handle: 'ana' },
              },
            ]),
          },
        },
        { provide: UserService, useValue: { search: vi.fn() } },
        { provide: FeedbackService, useValue: { success, error } },
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string, params?: Record<string, unknown>) => {
              if (params && Object.keys(params).length > 0) {
                return `${key}:${JSON.stringify(params)}`;
              }
              return key;
            },
          },
        },
      ],
    });
    const service = TestBed.inject(SendToService);
    const sheet = TestBed.runInInjectionContext(() => new SendToSheet());
    return { sheet, service, shareTo, success, error };
  }

  it('lists recent chats, picks people and sends with the caption', async () => {
    const { sheet, service, shareTo, success } = setup([
      { recipientId: 'u-1', status: 'SENT', conversationId: 'c-1', reason: null },
    ]);
    service.open({ ref: { type: 'SESSION', id: 's-1' }, title: 'Yoga' });
    TestBed.tick();

    expect(sheet.open()).toBe(true);
    expect(sheet.rows().map((p) => p.id)).toEqual(['u-1']);
    sheet.toggle(sheet.rows()[0]);
    sheet.caption.set('  Join?  ');
    expect(sheet.canSave()).toBe(true);

    await sheet.save();

    expect(shareTo).toHaveBeenCalledWith(['u-1'], { type: 'SESSION', id: 's-1' }, 'Join?');
    expect(success).toHaveBeenCalledWith('share.toast.sent:{"count":1}');
    expect(service.target()).toBeNull();
  });

  it('says when nobody could get it', async () => {
    const { sheet, service, error } = setup([
      { recipientId: 'u-1', status: 'REFUSED', conversationId: null, reason: 'x' },
    ]);
    service.open({ ref: { type: 'GROUP', id: 'g-1' }, title: 'Runners' });
    TestBed.tick();
    sheet.toggle(sheet.rows()[0]);

    await sheet.save();

    expect(error).toHaveBeenCalledWith(null, 'share.toast.none');
  });
});
