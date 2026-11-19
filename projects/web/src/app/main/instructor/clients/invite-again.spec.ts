import { describe, expect, it, vi } from 'vitest';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

import { isInvitationWaiting, showInviteAgainError } from './invite-again';

const translate = { instant: (key: string) => key } as unknown as TranslateService;

describe('Invite again', () => {
  it('reads a 409 as an invitation already waiting', () => {
    expect(isInvitationWaiting({ status: 409 })).toBe(true);
    expect(isInvitationWaiting({ status: 500 })).toBe(false);
    expect(isInvitationWaiting(null)).toBe(false);
  });

  it('says an invitation is already waiting rather than that it failed', () => {
    const add = vi.fn();
    showInviteAgainError({ add } as unknown as MessageService, translate, { status: 409 });
    expect(add).toHaveBeenCalledWith({
      severity: 'info',
      summary: 'clients.toast.alreadyInvited.summary',
      detail: 'clients.toast.alreadyInvited.detail',
    });
  });
});
