import { Component, inject, input, model } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonItem,
  IonLabel,
  IonModal,
  IonRow,
} from '@ionic/angular/standalone';

import { AuthStore } from 'core';

import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { MoreTile } from '../../_shared/models/tab.model';

/**
 * The overflow surface behind the "More" tab: the nav tiles that don't warrant
 * a tab slot, and a link to the profile. Role switching deliberately lives
 * elsewhere — the home top bar's role pill is the single entry point.
 *
 * Rendered as a sibling of `<ion-tabs>` rather than inside it, so it stays out
 * of `IonTabs`' content projection and away from its tab-bar relocation logic.
 */
@Component({
  selector: 'mh-more-sheet',
  imports: [HexAvatar, IonCol, IonContent, IonGrid, IonIcon, IonItem, IonLabel, IonModal, IonRow],
  templateUrl: './more-sheet.html',
  styleUrl: './more-sheet.scss',
})
export class MoreSheet {
  private readonly _authStore = inject(AuthStore);
  private readonly _router = inject(Router);

  readonly open = model(false);
  readonly tiles = input.required<readonly MoreTile[]>();

  readonly user = this._authStore.user;
  readonly userName = this._authStore.userName;

  openTile(tile: MoreTile): void {
    this.open.set(false);
    void this._router.navigateByUrl(tile.route);
  }

  /** The identity row is the other way into the account area, same as the
   *  home header's avatar. */
  openAccount(): void {
    this.open.set(false);
    void this._router.navigateByUrl('/tabs/home/account');
  }
}
