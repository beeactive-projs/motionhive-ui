import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { GroupMember, GroupService } from 'core';

import { JoinGroupPage } from './join-group';

describe('JoinGroupPage', () => {
  function setup(token: string | null, join: GroupService['joinViaLink']) {
    const router = { navigate: vi.fn(() => Promise.resolve(true)) };
    const groupService = { joinViaLink: vi.fn(join) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GroupService, useValue: groupService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(token ? { token } : {}) } },
        },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new JoinGroupPage());
    return { page, router, groupService };
  }

  it('joins with the link and swaps itself for the group, once', () => {
    const { page, router, groupService } = setup('tok-1', () =>
      of({ groupId: 'g-1' } as GroupMember),
    );
    page.ionViewWillEnter();
    page.ionViewWillEnter();

    expect(groupService.joinViaLink).toHaveBeenCalledTimes(1);
    expect(groupService.joinViaLink).toHaveBeenCalledWith('tok-1');
    expect(router.navigate).toHaveBeenCalledWith(['/tabs/groups', 'g-1'], { replaceUrl: true });
    expect(page.error()).toBeNull();
  });

  it("says what went wrong when the link doesn't work", () => {
    const { page, router } = setup('old', () =>
      throwError(
        () => new HttpErrorResponse({ status: 404, error: { message: 'This link was revoked.' } }),
      ),
    );
    page.ionViewWillEnter();

    expect(page.error()).toBe('This link was revoked.');
    expect(router.navigate).not.toHaveBeenCalled();
    page.goToGroups();
    expect(router.navigate).toHaveBeenCalledWith(['/tabs/groups'], { replaceUrl: true });
  });

  it('treats a link without a token as expired', () => {
    const { page, groupService } = setup(null, () => of());
    page.ionViewWillEnter();

    expect(page.error()).toBe('groups.joinLink.invalidOrExpired');
    expect(groupService.joinViaLink).not.toHaveBeenCalled();
  });
});
