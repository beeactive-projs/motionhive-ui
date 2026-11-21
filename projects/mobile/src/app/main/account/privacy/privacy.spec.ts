import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { MessagingService, ProfileService, UserService } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { AccountStore } from '../account.store';
import { AccountPrivacy, PRIVACY_ROWS } from './privacy';

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

describe('AccountPrivacy, birthday and gender', () => {
  function setup(privacySettings: Record<string, string>) {
    const updatePrivacy = vi.fn((patch: Record<string, string>) => ({
      pipe: () => ({
        subscribe: (o: { next: (answer: { privacySettings: Record<string, string> }) => void }) =>
          o.next({ privacySettings: { ...privacySettings, ...patch } }),
      }),
    }));
    const accountSignal = signal<Record<string, unknown> | null>({ privacySettings });
    const patchAccount = vi.fn((patch: Record<string, unknown>) =>
      accountSignal.update((current) => {
        if (!current) {
          return current;
        }
        return { ...current, ...patch };
      }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ProfileService, useValue: { updatePrivacy } },
        { provide: MessagingService, useValue: {} },
        { provide: UserService, useValue: {} },
        { provide: FeedbackService, useValue: { error: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: Router, useValue: {} },
        { provide: AccountStore, useValue: { account: accountSignal, patchAccount } },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new AccountPrivacy());
    return { page, updatePrivacy };
  }

  const birthday = PRIVACY_ROWS.find((row) => row.field === 'birthDate')!;
  const gender = PRIVACY_ROWS.find((row) => row.field === 'gender')!;

  it('lists both after the other details, coaches only by default', () => {
    expect(PRIVACY_ROWS.map((row) => row.field).slice(-2)).toEqual(['birthDate', 'gender']);
    const { page } = setup({});
    expect(page.levelOf('birthDate')).toBe('COACHES_ONLY');
    expect(page.levelOf('gender')).toBe('COACHES_ONLY');
  });

  it('says the birthday shows as an age, in the row and in each level', () => {
    const { page } = setup({});
    expect(page.noteOf(birthday)).toBe('account.privacy.birthdayNote');
    expect(page.noteOf(gender)).toBeNull();

    page.choose(birthday);
    expect(page.levelOptions().map((option) => option.hint)).toEqual([
      'account.privacy.ageHint.PUBLIC',
      'account.privacy.ageHint.COACHES_ONLY',
      'account.privacy.ageHint.ONLY_ME',
    ]);
    page.choose(gender);
    expect(page.levelOptions()[0].hint).toBe('account.privacy.hint.PUBLIC');
  });

  it('saves a new level for the gender', () => {
    const { page, updatePrivacy } = setup({});
    page.choose(gender);
    page.onPicked('ONLY_ME');
    expect(updatePrivacy).toHaveBeenCalledWith({ gender: 'ONLY_ME' });
    expect(page.levelOf('gender')).toBe('ONLY_ME');
  });
});
