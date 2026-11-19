import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

import { showApiError } from 'core';

/** A 409 on an invitation: one is already waiting between the two of them. */
export function isInvitationWaiting(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  return (err as { status?: unknown }).status === 409;
}

/**
 * The failure of "Invite again", shared by the client list and the client
 * page. An invitation already waiting is said as that, not as a failure.
 */
export function showInviteAgainError(
  messages: MessageService,
  translate: TranslateService,
  err: unknown,
): void {
  if (isInvitationWaiting(err)) {
    messages.add({
      severity: 'info',
      summary: translate.instant('clients.toast.alreadyInvited.summary'),
      detail: translate.instant('clients.toast.alreadyInvited.detail'),
    });
    return;
  }
  showApiError(
    messages,
    translate.instant('clients.toast.inviteAgainFailed.summary'),
    translate.instant('clients.toast.inviteAgainFailed.detail'),
    err,
  );
}
