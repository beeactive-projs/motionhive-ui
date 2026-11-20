import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { MessagingService, ProfileService, UserService } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { AccountStore } from '../account.store';
import { AccountPrivacy } from './privacy';

describe('AccountPrivacy, your data', () => {
  it('opens Sensitive actions, where Delete account lives', () => {
    const navigateByUrl = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        { provide: ProfileService, useValue: {} },
        { provide: FeedbackService, useValue: {} },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: Router, useValue: { navigateByUrl } },
        { provide: AccountStore, useValue: { account: signal(null) } },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new AccountPrivacy());

    page.openSensitive();

    expect(navigateByUrl).toHaveBeenCalledWith('/tabs/more/account/sensitive');
  });
});

describe('AccountPrivacy, messages', () => {
  function setup(account: Record<string, unknown>) {
    const updateSettings = vi.fn(() => ({ pipe: () => ({ subscribe: (o: { next: () => void }) => o.next() }) }));
    const updateMe = vi.fn(() => ({ pipe: () => ({ subscribe: (o: { next: () => void }) => o.next() }) }));
    const accountSignal = signal<Record<string, unknown> | null>(account);
    const patchAccount = vi.fn((patch: Record<string, unknown>) =>
      accountSignal.update((current) => (current ? { ...current, ...patch } : current)),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ProfileService, useValue: {} },
        { provide: MessagingService, useValue: { updateSettings } },
        { provide: UserService, useValue: { updateMe } },
        { provide: FeedbackService, useValue: { error: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: Router, useValue: {} },
        { provide: AccountStore, useValue: { account: accountSignal, patchAccount } },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new AccountPrivacy());
    return { page, updateSettings, updateMe, patchAccount };
  }

  it('reads the defaults when the API says nothing: requests, and findable by name', () => {
    const { page } = setup({});
    expect(page.whoCanMessage()).toBe('REQUESTS');
    expect(page.findByName()).toBe(true);
    expect(page.whoCanMessageLabel()).toBe('account.privacy.messages.whoShort.REQUESTS');
    expect(page.whoOptions().map((o) => o.value)).toEqual(['EVERYONE', 'REQUESTS', 'CONNECTIONS']);
  });

  it('saves who can message on the pick', () => {
    const { page, updateSettings } = setup({});
    page.onWhoPicked('CONNECTIONS');
    expect(updateSettings).toHaveBeenCalledWith({ whoCanMessage: 'CONNECTIONS' });
    expect(page.whoCanMessage()).toBe('CONNECTIONS');
  });

  it('turns find by name off and saves it on the account', () => {
    const { page, updateMe } = setup({ findByName: true });
    page.toggleFindByName();
    expect(updateMe).toHaveBeenCalledWith({ findByName: false });
    expect(page.findByName()).toBe(false);
  });
});
