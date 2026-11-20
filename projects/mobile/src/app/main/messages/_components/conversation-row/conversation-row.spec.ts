import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { ConversationListItem } from 'core';

import { ConversationRow } from './conversation-row';

function conversation(patch: Partial<ConversationListItem> = {}): ConversationListItem {
  return {
    id: 'c-1',
    type: 'DIRECT',
    name: null,
    avatarUrl: null,
    lastMessageAt: null,
    lastMessagePreview: 'Morning yoga flow',
    unreadCount: 0,
    muted: false,
    otherUser: null,
    lastReadByOther: null,
    ...patch,
  };
}

describe('ConversationRow, shares and archive', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
    });
    TestBed.overrideComponent(ConversationRow, { set: { template: '', imports: [] } });
  });

  function row(value: ConversationListItem) {
    const fixture = TestBed.createComponent(ConversationRow);
    fixture.componentRef.setInput('conversation', value);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('says what the last message shared before its words', () => {
    expect(row(conversation({ lastMessageAttachmentType: 'SESSION' })).preview()).toBe(
      'messages.shared.SESSION · Morning yoga flow',
    );
    expect(row(conversation()).preview()).toBe('Morning yoga flow');
  });

  it('knows an archived chat, for the swipe to bring it back', () => {
    expect(row(conversation({ archived: true })).isArchived()).toBe(true);
  });
});
