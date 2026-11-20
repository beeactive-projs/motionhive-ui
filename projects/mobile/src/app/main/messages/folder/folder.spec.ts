import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { MessagingStore } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ConversationFolderPage } from './folder';

describe('ConversationFolderPage', () => {
  function setup(folder: string) {
    const folders = signal<Record<string, boolean>>({});
    const store = {
      requestConversations: computed(() => [{ id: 'r-1' }]),
      archivedConversations: computed(() => [{ id: 'a-1' }, { id: 'a-2' }]),
      folderLoaded: (name: string) => folders()[name] ?? false,
      loadFolder: vi.fn((name: string) => folders.update((all) => ({ ...all, [name]: true }))),
      openConversation: vi.fn(),
      setArchived: vi.fn(() => Promise.resolve(true)),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MessagingStore, useValue: store },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { folder } } } },
        { provide: FeedbackService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new ConversationFolderPage());
    return { page, store };
  }

  it('lists the requests, fetching the folder on entry', () => {
    const { page, store } = setup('requests');
    expect(page.showSkeleton()).toBe(false);
    page.ionViewWillEnter();
    expect(store.loadFolder).toHaveBeenCalledWith('requests');
    expect(page.rows().map((c) => c.id)).toEqual(['r-1']);
    expect(page.copy.title).toBe('messages.requests.title');
  });

  it('lists archived chats and brings one back', async () => {
    const { page, store } = setup('archived');
    expect(page.rows().length).toBe(2);
    await page.unarchive(page.rows()[0]);
    expect(store.setArchived).toHaveBeenCalledWith('a-1', false);
  });
});
