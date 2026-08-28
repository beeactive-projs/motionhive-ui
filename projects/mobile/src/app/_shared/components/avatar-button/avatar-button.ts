import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/standalone';

import { AuthStore } from 'core';

import { HexAvatar } from '../hex-avatar/hex-avatar';

/**
 * The signed-in user's avatar as a tab-root header action, opening the
 * account page.
 *
 * Unlike the bell it links to a fixed address: the account stack is mounted
 * under the home tab only (app.routes.ts), so there is no per-tab copy to
 * stay inside. Geometry comes from the shared `ion-button.glyph` skin.
 */
@Component({
  selector: 'mh-avatar-button',
  imports: [HexAvatar, IonButton, RouterLink],
  templateUrl: './avatar-button.html',
})
export class AvatarButton {
  private readonly _authStore = inject(AuthStore);

  readonly userName = this._authStore.userName;
  readonly avatarUrl = computed(() => this._authStore.user()?.avatarUrl ?? null);
}
