import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { MessageView } from 'core';

import { MessageBubble } from './message-bubble';

function message(patch: Partial<MessageView> = {}): MessageView {
  return {
    id: 'm-1',
    conversationId: 'c-1',
    senderId: 'u-1',
    kind: 'TEXT',
    body: 'hello',
    deletedAt: null,
    createdAt: '2026-11-20T10:00:00Z',
    ...patch,
  };
}

describe('MessageBubble, shares', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
    });
    TestBed.overrideComponent(MessageBubble, { set: { template: '', imports: [] } });
  });

  function bubble(value: MessageView) {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('message', value);
    fixture.componentRef.setInput('position', 'only');
    fixture.componentRef.setInput('isMine', false);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const attachment = {
    type: 'SESSION' as const,
    id: 's-1',
    card: { type: 'SESSION' as const, state: 'UNAVAILABLE' as const, name: null },
  };

  it('a share with no caption draws the card and no bubble', () => {
    const view = bubble(message({ body: 'Yoga', caption: '', attachments: [attachment] }));
    expect(view.attachments().length).toBe(1);
    expect(view.text()).toBe('');
  });

  it('a share with a caption shows the caption under the card', () => {
    const view = bubble(message({ body: 'Join?', caption: 'Join?', attachments: [attachment] }));
    expect(view.text()).toBe('Join?');
  });

  it('a deleted message shows no card and the local wording', () => {
    const view = bubble(
      message({ deletedAt: '2026-11-20T11:00:00Z', attachments: [attachment] }),
    );
    expect(view.attachments()).toEqual([]);
    expect(view.text()).toBe('messages.bubble.deleted');
  });
});
