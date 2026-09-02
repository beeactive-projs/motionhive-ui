import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';

import { AppModeStore, AuthStore } from 'core';

import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { SettingsRow } from '../../_shared/components/settings-row/settings-row';
import { ROLES } from '../../_shared/config/roles.config';
import { resolveMode, TAB_SETS } from '../../_shared/config/tabs.config';
import { MoreSection, MoreTile } from '../../_shared/models/tab.model';
import { MoreBadgesService } from '../../_shared/services/more-badges.service';

/**
 * The menu page behind the Menu tab — Messenger-style: an identity card that
 * leads into the account area, then the destinations that didn't earn a tab
 * slot as chevroned rows, grouped by intent the way web's rail is. The
 * identity area also carries a Switch role row — the same door as the home
 * top bar's role pill, for whoever has a second role.
 *
 * Icons come from `TAB_ICONS`, registered once by the tab shell that hosts
 * this page.
 */
@Component({
  selector: 'mh-more',
  imports: [
    HexAvatar,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonTitle,
    IonToolbar,
    NotificationBell,
    SettingsRow,
  ],
  templateUrl: './more.html',
  styleUrl: './more.scss',
})
export class More implements ViewWillEnter {
  private readonly _router = inject(Router);
  private readonly _authStore = inject(AuthStore);
  private readonly _appModeStore = inject(AppModeStore);
  private readonly _moreBadgesService = inject(MoreBadgesService);

  readonly user = this._authStore.user;
  readonly userName = this._authStore.userName;

  /** Only an instructor has a second role to switch to — same gate as home's pill. */
  readonly canSwitchRole = this._authStore.isInstructor;

  private readonly _mode = computed(() =>
    resolveMode(this._authStore.isInstructor(), this._appModeStore.mode()),
  );

  /** Named the way the pill names it — "Coach"/"Trainee", never the mode word. */
  readonly roleLabel = computed(() => ROLES[this._mode()].label);

  /** The mode's sections, with the live dots spliced onto their rows. */
  readonly sections = computed<readonly MoreSection[]>(() => {
    return TAB_SETS[this._mode()].more
      .map((section) => ({
        ...section,
        items: section.items
          .filter((entry) => !entry.requiresInstructor || this._authStore.isInstructor())
          .map((entry) => {
            if (entry.route === '/tabs/home/billing') {
              return { ...entry, dot: this._moreBadgesService.hasBillDue };
            }
            if (entry.route === '/tabs/clients/requests') {
              return { ...entry, dot: this._moreBadgesService.hasPendingRequests };
            }
            return entry;
          }),
      }))
      .filter((section) => section.items.length > 0);
  });

  /** Tab pages stay alive, so re-entering is the moment a dot can be stale. */
  ionViewWillEnter(): void {
    this._moreBadgesService.refresh();
  }

  open(entry: MoreTile): void {
    void this._router.navigateByUrl(entry.route);
  }

  /** Same destination as the home pill — a page that explains what a switch changes. */
  openSwitchRole(): void {
    void this._router.navigateByUrl('/tabs/home/switch-role');
  }

  /** The identity card is the way into the account area, same as the home
   *  header's avatar. */
  openAccount(): void {
    void this._router.navigateByUrl('/tabs/home/account');
  }
}
