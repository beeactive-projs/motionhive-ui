import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessagingStore, UserSearchResult, UserService } from 'core';

import { NewMessagePicker } from './new-message-picker';

const ana = { id: 'u-2', firstName: 'Ana', lastName: 'Pop', avatarUrl: null, handle: null } as UserSearchResult;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('NewMessagePicker, searching', () => {
  it('keeps searching after one search fails', () => {
    const search = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of([ana]));
    TestBed.overrideComponent(NewMessagePicker, { set: { template: '', imports: [] } });
    TestBed.configureTestingModule({
      providers: [
        { provide: UserService, useValue: { search } },
        {
          provide: MessagingStore,
          useValue: {
            composeRecipient: signal(null),
            pendingMessagesFor: () => ({ items: [] }),
          },
        },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const picker = TestBed.createComponent(NewMessagePicker).componentInstance as unknown as {
      onQueryChange(value: string): void;
      results(): UserSearchResult[];
    };

    picker.onQueryChange('an');
    vi.advanceTimersByTime(250);
    expect(picker.results()).toEqual([]);

    picker.onQueryChange('ana');
    vi.advanceTimersByTime(250);
    expect(search).toHaveBeenCalledTimes(2);
    expect(picker.results()).toEqual([ana]);
  });
});
