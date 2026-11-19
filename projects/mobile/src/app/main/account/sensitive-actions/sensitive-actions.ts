import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { SettingsRow } from '../../../_shared/components/settings-row/settings-row';
import { ProfileStacks } from '../../../_shared/utils/stack-paths';
import { ACCOUNT_ICONS } from '../account.config';

/**
 * The actions that cannot be undone, one level under Privacy (owner,
 * 2026-11-18): out of the way of everyday settings, still findable as Apple
 * asks. Each opens its own page that explains before anything happens.
 */
@Component({
  selector: 'mh-sensitive-actions',
  imports: [
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonList,
    IonNote,
    IonTitle,
    IonToolbar,
    SettingsRow,
    TranslatePipe,
  ],
  templateUrl: './sensitive-actions.html',
})
export class SensitiveActions {
  private readonly _router = inject(Router);

  constructor() {
    addIcons(ACCOUNT_ICONS);
  }

  /** Delete account: its page explains, then asks for a code and a word. */
  openDelete(): void {
    void this._router.navigateByUrl(`${ProfileStacks.Account}/delete`);
  }
}
