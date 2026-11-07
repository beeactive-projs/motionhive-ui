import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthStore } from 'core';

import { APP_HEX_SHAPE, HexShape } from '../../config/hexagon.config';
import { HexAvatar } from '../hex-avatar/hex-avatar';

/**
 * The signed-in user's avatar as a tab-root header action, opening the
 * account page.
 *
 * Unlike the bell it links to a fixed address: the account stack is mounted
 * under the Menu tab only (app.routes.ts), so there is no per-tab copy to
 * stay inside. Geometry comes from the shared `ion-button.glyph` skin.
 */
@Component({
  selector: 'mh-avatar-button',
  imports: [HexAvatar, IonButton, RouterLink, TranslatePipe],
  templateUrl: './avatar-button.html',
})
export class AvatarButton {
  private readonly _authStore = inject(AuthStore);

  /**
   * The avatar's hexagon: the app's, or the pointy one Discover's page draws.
   * `hexShape`, not `shape`: the button wears Ionic's `shape="round"`.
   */
  readonly hexShape = input<HexShape>(APP_HEX_SHAPE);

  readonly userName = this._authStore.userName;
  readonly avatarUrl = computed(() => this._authStore.user()?.avatarUrl ?? null);
}
