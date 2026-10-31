import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
  IonBackButton,
  IonBadge,
  IonButtons,
  IonCard,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonText,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle } from 'ionicons/icons';

import { AppModeStore, NavMode } from 'core';

import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { ROLE_ICONS, ROLE_LIST, UPCOMING_ROLES } from '../../../_shared/config/roles.config';
import { HOME_STACK, homeOr } from '../../home/home-stack.config';

/**
 * The role picker behind the home top bar's pill and the Switch role rows on
 * the menu and account pages.
 *
 * A pushed page rather than a sheet: switching role re-renders home, the tab
 * bar and the notification scope, which is more than a toggle should do
 * silently. It sits on the Menu stack and on Home's (the pill), back
 * returns to whichever opened it, and picking a role always lands on Home,
 * a tab both roles have — nothing can be orphaned by the switch.
 */
@Component({
  selector: 'mh-switch-role',
  imports: [
    HexAvatar,
    IonBackButton,
    IonBadge,
    IonButtons,
    IonCard,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonText,
    IonTitle,
    IonToolbar,
    TranslatePipe,
  ],
  templateUrl: './switch-role.html',
  styleUrl: './switch-role.scss',
})
export class SwitchRole {
  private readonly _appModeStore = inject(AppModeStore);
  private readonly _navController = inject(NavController);
  private readonly _router = inject(Router);

  /** Back on a cold load: the Menu, or Home when the pill opened it. */
  readonly backHref = homeOr(this._router.url, '/tabs/more');

  readonly roles = ROLE_LIST;
  readonly upcoming = UPCOMING_ROLES;
  readonly mode = this._appModeStore.mode;

  constructor() {
    addIcons({ ...ROLE_ICONS, checkmarkCircle });
  }

  /** Picking the current role is a no-op beyond going back, per the design. */
  pick(mode: NavMode): void {
    this._appModeStore.setMode(mode);
    // navigateBack, not `back()` — a deep link into this page has no history
    // to pop, and this animates the same either way.
    void this._navController.navigateBack(HOME_STACK);
  }
}
