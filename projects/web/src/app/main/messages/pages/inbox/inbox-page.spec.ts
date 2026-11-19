import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { MessagingStore } from 'core';

import { InboxPage } from './inbox-page';

function setup(query: Record<string, string>) {
  const navigate = vi.fn(() => Promise.resolve(true));
  const enterComposeMode = vi.fn();
  TestBed.overrideComponent(InboxPage, { set: { template: '', imports: [] } });
  TestBed.configureTestingModule({
    providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      { provide: Router, useValue: { navigate } },
      {
        provide: MessagingStore,
        useValue: {
          loadConversations: vi.fn(),
          hasLoaded: signal(true),
          conversations: signal([]),
          activeId: signal(null),
          enterComposeMode,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(InboxPage);
  fixture.detectChanges();
  return { navigate, enterComposeMode };
}

describe('InboxPage', () => {
  it('opens the thread a bell or email link names', () => {
    const { navigate } = setup({ conversationId: 'conv-9' });
    expect(navigate).toHaveBeenCalledWith(['/messages', 'conv-9'], { replaceUrl: true });
  });

  it('opens the picker addressed to the person when there is no thread yet', () => {
    const { enterComposeMode } = setup({ to: 'user-2', name: 'Ana Pop' });
    expect(enterComposeMode).toHaveBeenCalledWith({
      id: 'user-2',
      firstName: 'Ana Pop',
      lastName: null,
      avatarUrl: null,
      handle: null,
    });
  });
});
