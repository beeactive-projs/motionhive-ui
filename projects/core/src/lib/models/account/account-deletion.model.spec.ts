import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { scheduledDeletionFrom } from './account-deletion.model';

const forbidden = (error: unknown) => new HttpErrorResponse({ status: 403, error });

describe('scheduledDeletionFrom', () => {
  it('reads the offer to keep an account out of a sign-in refusal', () => {
    expect(
      scheduledDeletionFrom(
        forbidden({
          code: 'ACCOUNT_SCHEDULED_FOR_DELETION',
          restoreTicket: 't',
          scheduledFor: '2026-11-14T10:00:00.000Z',
          message: 'Scheduled',
        }),
      ),
    ).toEqual({ restoreTicket: 't', scheduledFor: '2026-11-14T10:00:00.000Z', message: 'Scheduled' });
  });

  it('ignores every other refusal', () => {
    expect(scheduledDeletionFrom(forbidden({ message: 'Access denied' }))).toBeNull();
    expect(scheduledDeletionFrom(new HttpErrorResponse({ status: 401, error: {} }))).toBeNull();
    expect(scheduledDeletionFrom(new Error('offline'))).toBeNull();
  });
});
