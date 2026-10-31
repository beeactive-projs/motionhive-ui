import { inject } from '@angular/core';
import { Router } from '@angular/router';

import { injectOpenDirectMessage } from '../../../_shared/utils/direct-message';
import { clientPath, CoachStacks } from '../../clients/client-paths';
import { CLIENT_REQUESTS_URL } from '../../clients/clients.filters';
import { NeedActions, NeedRow } from '../home.config';

/**
 * What a Needs you verb does, on Home and on its page alike. Each opens a
 * screen that already does the job; nothing is done from here.
 *
 * - Review: the Clients tab on its Requests chip.
 * - Message: the chat, in the stack it was asked from (Home's), so back
 *   returns here (`injectOpenDirectMessage`).
 * - Assign / Open: the client page, in Home's stack too (`client-paths.ts`),
 *   so back returns to Home or to the Needs you page it was opened from.
 *
 * Call from an injection context.
 */
export function injectActOnNeed(): (row: NeedRow) => void {
  const router = inject(Router);
  const openDirectMessage = injectOpenDirectMessage();

  return (row) => {
    switch (row.action) {
      case NeedActions.Review:
        void router.navigateByUrl(CLIENT_REQUESTS_URL);
        return;
      case NeedActions.Message:
        if (row.person) openDirectMessage({ id: row.person.id, firstName: row.person.name });
        return;
      case NeedActions.OpenClient:
        if (row.person) void router.navigate(clientPath(CoachStacks.Home, row.person.id));
        return;
    }
  };
}
