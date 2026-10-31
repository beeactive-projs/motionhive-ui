import { Component, computed, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { AppModeStore, AuthStore, NavMode, NavModes } from 'core';

import { AvatarButton } from '../../_shared/components/avatar-button/avatar-button';
import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { Logo } from '../../_shared/components/logo/logo';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { ROLE_ICONS, ROLES } from '../../_shared/config/roles.config';
import { CoachHome } from './coach-home/coach-home';
import { HomePages } from './home-stack.config';
import { HOME_ICONS } from './home.icons';
import { TrainHome } from './train-home/train-home';

/**
 * Mode-adaptive landing page. The host owns the chrome (header, role pill,
 * pull-to-refresh) and delegates the body to whichever child matches the
 * active mode, so neither child has to know the other exists.
 *
 * It also owns Ionic's page lifecycle: `ionViewWillEnter` reaches the routed
 * component only, never a child, so the host tells the body when Home is
 * shown again.
 */
@Component({
  selector: 'mh-home',
  imports: [
    AvatarButton,
    CoachHome,
    HexAvatar,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonToolbar,
    Logo,
    NotificationBell,
    TrainHome,
    TranslatePipe,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  // Words wrap whole, header included; a line that cannot grow ellipses.
  host: { class: 'mh-whole-words' },
})
export class Home implements ViewWillEnter {
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

  /** The first entry is the body's own first load (`ngOnInit`). */
  private _entered = false;

  constructor() {
    addIcons({ ...ROLE_ICONS, ...HOME_ICONS });
  }

  /** In Home's stack, so back returns here; picking a role lands here too. */
  openRoleSwitch(): void {
    void this._router.navigateByUrl(HomePages.SwitchRole);
  }

  /** Discover's search, the same screen as its tab's, in Home's stack. */
  openSearch(): void {
    void this._router.navigateByUrl(HomePages.Search);
  }

  /** Coming back to a tab page that stayed alive: the body reloads. */
  ionViewWillEnter(): void {
    if (this._entered) this._active()?.reenter();
    this._entered = true;
  }

  /** The spinner stays until every block of the body has answered. */
  onRefresh(event: RefresherCustomEvent): void {
    const done = () => void event.target.complete();
    const active = this._active();
    if (active) active.refresh(done);
    else done();
  }

  /** Only one child is ever mounted, so this reaches whichever it is. */
  private _active(): CoachHome | TrainHome | undefined {
    return this._coachHome() ?? this._trainHome();
  }
}
