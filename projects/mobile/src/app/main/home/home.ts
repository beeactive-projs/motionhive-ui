import { Component, computed, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { AppModeStore, AuthStore, NavMode, NavModes } from 'core';

import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { Logo } from '../../_shared/components/logo/logo';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { ROLE_ICONS, ROLES } from '../../_shared/config/roles.config';
import { CoachHome } from './coach-home/coach-home';
import { TrainHome } from './train-home/train-home';

/**
 * Mode-adaptive landing page. The host owns the chrome — header, role pill,
 * pull-to-refresh — and delegates the body to whichever child matches the
 * active mode, so neither child has to know the other exists.
 */
@Component({
  selector: 'mh-home',
  imports: [
    CoachHome,
    HexAvatar,
    IonButton,
    IonButtons,
    IonCard,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonToolbar,
    Logo,
    NotificationBell,
    TrainHome,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly _authStore = inject(AuthStore);
  private readonly _appModeStore = inject(AppModeStore);
  private readonly _router = inject(Router);

  private readonly _coachHome = viewChild(CoachHome);
  private readonly _trainHome = viewChild(TrainHome);

  readonly NavModes = NavModes;

  /**
   * Whether the session has told us which roles this account holds. `AuthStore`
   * starts empty, and "no INSTRUCTOR role yet" is indistinguishable from "not a
   * coach" — so the body waits rather than guessing.
   */
  readonly roleKnown = computed(() => this._authStore.user() !== null);

  /** Only an instructor has a second role to switch to. */
  readonly canSwitchMode = this._authStore.isInstructor;

  readonly mode = computed<NavMode>(() =>
    this.canSwitchMode() ? this._appModeStore.mode() : NavModes.Train,
  );

  readonly role = computed(() => ROLES[this.mode()]);

  readonly userName = this._authStore.userName;
  readonly avatarUrl = computed(() => this._authStore.user()?.avatarUrl ?? null);

  constructor() {
    addIcons(ROLE_ICONS);
  }

  openRoleSwitch(): void {
    void this._router.navigateByUrl('/tabs/home/switch-role');
  }

  openProfile(): void {
    void this._router.navigateByUrl('/tabs/home/account');
  }

  /** Only one child is ever mounted, so this reaches whichever it is. */
  onRefresh(event: RefresherCustomEvent): void {
    const done = () => void event.target.complete();
    const active = this._coachHome() ?? this._trainHome();
    if (active) active.store.refresh(done);
    else done();
  }
}
