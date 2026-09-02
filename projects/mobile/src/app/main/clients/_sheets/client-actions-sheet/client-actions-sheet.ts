import { Component, computed, input, model, output } from '@angular/core';
import { IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { InstructorClient, clientDisplayName, clientEmail } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { CLIENT_ICONS, ClientActionId, visibleClientActions } from '../../clients.config';

/**
 * The verbs for one client — the ⋮ on the detail screen.
 *
 * A component rather than `ActionSheetController`, for the same two reasons
 * as the session actions sheet: the head row (avatar, name, address) is not
 * something the controller can render, and an action sheet built in
 * TypeScript hides its icon names from the config spec's template scanner.
 *
 * The sheet only reports which verb was chosen; the page owns what it does.
 */
@Component({
  selector: 'mh-client-actions-sheet',
  imports: [HexAvatar, IonIcon, IonItem, IonLabel, IonList, SheetShell],
  templateUrl: './client-actions-sheet.html',
  styleUrl: './client-actions-sheet.scss',
})
export class ClientActionsSheet {
  readonly open = model(false);
  readonly client = input<InstructorClient | null>(null);

  readonly action = output<ClientActionId>();

  constructor() {
    addIcons(CLIENT_ICONS);
  }

  readonly name = computed(() => {
    const client = this.client();
    return client ? clientDisplayName(client) : 'Client';
  });

  readonly email = computed(() => {
    const client = this.client();
    return client ? clientEmail(client) : '';
  });

  readonly avatarUrl = computed(() => this.client()?.client?.avatarUrl ?? null);

  readonly avatarTone = computed(() => avatarToneFor(this.client()?.clientId));

  readonly visibleActions = computed(() => {
    const client = this.client();
    return client ? visibleClientActions(client) : [];
  });

  choose(id: ClientActionId): void {
    this.open.set(false);
    this.action.emit(id);
  }
}
