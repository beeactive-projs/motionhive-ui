import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ConversationListItem, MessagingStore, UserBlockReason } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ChatDetails } from './chat-details';

function setup() {
  const row = {
    id: 'conv-1',
    otherUser: { id: 'user-2', firstName: 'Ana', lastName: 'Pop' },
  } as unknown as ConversationListItem;
  const blockUser = vi.fn(() => Promise.resolve(true));
  const navigateByUrl = vi.fn(() => Promise.resolve(true));
  TestBed.overrideComponent(ChatDetails, { set: { template: '', imports: [] } });
  TestBed.configureTestingModule({
    providers: [
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'conv-1' })) } },
      { provide: Router, useValue: { url: '/tabs/messages/conv-1/details', navigateByUrl } },
      { provide: IonRouterOutlet, useValue: { canGoBack: () => false, pop: vi.fn() } },
      { provide: FeedbackService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      {
        provide: MessagingStore,
        useValue: {
          conversations: signal([row]),
          loading: signal(false),
          blockUser,
          loadConversations: vi.fn(),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ChatDetails);
  fixture.detectChanges();
  return { details: fixture.componentInstance, blockUser, navigateByUrl };
}

describe('ChatDetails, blocking', () => {
  it('leaves the chat once the person is blocked, as a deleted chat does', async () => {
    const { details, blockUser, navigateByUrl } = setup();

    await details.block('SPAM' as UserBlockReason);

    expect(blockUser).toHaveBeenCalledWith({
      blockedId: 'user-2',
      reason: 'SPAM',
      conversationId: 'conv-1',
    });
    expect(details.blockOpen()).toBe(false);
    expect(navigateByUrl).toHaveBeenCalledWith('/tabs/messages', { replaceUrl: true });
  });
});
