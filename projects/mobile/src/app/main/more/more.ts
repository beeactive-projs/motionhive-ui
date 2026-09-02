import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';

import { AppModeStore, AuthStore } from 'core';

import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { SettingsRow } from '../../_shared/components/settings-row/settings-row';
import { resolveMode, TAB_SETS } from '../../_shared/config/tabs.config';
import { MoreTile } from '../../_shared/models/tab.model';
import { MoreBadgesService } from '../../_shared/services/more-badges.service';

/**
 * The menu page behind the More tab — Messenger-style: an identity card that
 * leads into the account area, then the destinations that didn't earn a tab
 * slot as chevroned rows. Role switching deliberately lives elsewhere — the
 * home top bar's role pill is the single entry point.
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

  /** The mode's entries, with the live dots spliced onto their rows. */
  readonly entries = computed(() => {
    const mode = resolveMode(this._authStore.isInstructor(), this._appModeStore.mode());
    return TAB_SETS[mode].more
      .filter((entry) => !entry.requiresInstructor || this._authStore.isInstructor())
      .map((entry) => {
        if (entry.route === '/tabs/home/billing') {
          return { ...entry, dot: this._moreBadgesService.hasBillDue };
        }
        if (entry.route === '/tabs/clients/requests') {
          return { ...entry, dot: this._moreBadgesService.hasPendingRequests };
        }
        return entry;
      });
  });

  /** Tab pages stay alive, so re-entering is the moment a dot can be stale. */
  ionViewWillEnter(): void {
    this._moreBadgesService.refresh();
  }

  open(entry: MoreTile): void {
    void this._router.navigateByUrl(entry.route);
  }

  /** The identity card is the way into the account area, same as the home
   *  header's avatar. */
  openAccount(): void {
    void this._router.navigateByUrl('/tabs/home/account');
  }
}
