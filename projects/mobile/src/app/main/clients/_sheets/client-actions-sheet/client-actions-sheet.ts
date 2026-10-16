import { Component, computed, inject, input, model, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { InstructorClient, clientDisplayName, clientEmail } from 'core';

import { ActionSheet } from '../../../../_shared/components/action-sheet/action-sheet';
import { ClientActionId, visibleClientActions } from '../../clients.config';
import { CLIENT_ICONS } from '../../clients.icons';

/**
 * The verbs for one client — the ⋮ on the detail screen — under the client's
 * name and address.
 *
 * The sheet only reports which verb was chosen; the page owns what it does.
 */
@Component({
  selector: 'mh-client-actions-sheet',
  imports: [ActionSheet],
  templateUrl: './client-actions-sheet.html',
})
export class ClientActionsSheet {
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly client = input<InstructorClient | null>(null);

  readonly action = output<ClientActionId>();

  constructor() {
    addIcons(CLIENT_ICONS);
  }

  readonly name = computed(() => {
    const client = this.client();
    return client
      ? clientDisplayName(client)
      : this._translateService.instant('clients.clientFallback');
  });

  readonly email = computed(() => {
    const client = this.client();
    return client ? clientEmail(client) : '';
  });

  readonly visibleActions = computed(() => {
    const client = this.client();
    return client ? visibleClientActions(client) : [];
  });
}
