import { Component, Signal, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chatbubbleEllipsesOutline } from 'ionicons/icons';
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
import { FeedbackSheet } from './_sheets/feedback-sheet/feedback-sheet';

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
    FeedbackSheet,
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
    TranslatePipe,
  ],
  templateUrl: './more.html',
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

  /**
   * The rows that carry a live dot, by route. A static config cannot read a
   * store, so they are named here.
   */
  private readonly _dots = new Map<string, Signal<boolean>>([
    ['/tabs/more/billing', this._moreBadgesService.hasBillDue],
    ['/tabs/more/coaches', this._moreBadgesService.hasCoachInvites],
  ]);

  /** The mode's sections, with the live dots spliced onto their rows. */
  readonly sections = computed<readonly MoreSection[]>(() => {
    return TAB_SETS[this._mode()].more
      .map((section) => ({
        ...section,
        items: section.items.map((entry) => {
          const dot = this._dots.get(entry.route);
          return dot ? { ...entry, dot } : entry;
        }),
      }))
      .filter((section) => section.items.length > 0);
  });

  /** The feedback sheet, from the row at the foot of the menu. */
  readonly feedbackOpen = signal(false);

  constructor() {
    // The feedback row's glyph is the menu's own; the tab shell registers
    // only the icons its configs name.
    addIcons({ chatbubbleEllipsesOutline });
  }

  /** Tab pages stay alive, so re-entering is the moment a dot can be stale. */
  ionViewWillEnter(): void {
    this._moreBadgesService.refresh();
  }

  openFeedback(): void {
    this.feedbackOpen.set(true);
  }

  open(entry: MoreTile): void {
    void this._router.navigateByUrl(entry.route);
  }

  /** Same destination as the home pill — a page that explains what a switch changes. */
  openSwitchRole(): void {
    void this._router.navigateByUrl('/tabs/more/switch-role');
  }

  /** The identity card is the way into the account area, same as the home
   *  header's avatar. */
  openAccount(): void {
    void this._router.navigateByUrl('/tabs/more/account');
  }
}
