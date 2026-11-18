import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { ProfileService } from 'core';

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
