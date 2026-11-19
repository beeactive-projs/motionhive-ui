import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AuthStore, MessagingStore } from 'core';

import { ConversationPane } from './conversation-pane';

function setup() {
  const activeId = signal<string | null>(null);
  const store = {
    activeId,
    activeConversation: signal(null),
    messagesFor: () => ({ items: [], nextBefore: null, loading: false }),
    setActiveId: vi.fn((id: string | null) => activeId.set(id)),
    loadMessages: vi.fn(),
    markReadOnEntry: vi.fn(),
  };
  TestBed.overrideComponent(ConversationPane, { set: { template: '', imports: [] } });
  TestBed.configureTestingModule({
    providers: [
      { provide: MessagingStore, useValue: store },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'conv-1' })) } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: AuthStore, useValue: { user: signal({ id: 'me' }) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const fixture = TestBed.createComponent(ConversationPane);
  fixture.detectChanges();
  return { fixture, store, activeId };
}

describe('ConversationPane, leaving the thread', () => {
  it('lets go of the thread when the pane goes, so new messages are not read by nobody', () => {
    const { fixture, activeId } = setup();
    expect(activeId()).toBe('conv-1');

    fixture.destroy();

    expect(activeId()).toBeNull();
  });

  it('leaves a thread another pane has claimed since', () => {
    const { fixture, activeId } = setup();
    activeId.set('conv-2');

    fixture.destroy();

    expect(activeId()).toBe('conv-2');
  });
});
