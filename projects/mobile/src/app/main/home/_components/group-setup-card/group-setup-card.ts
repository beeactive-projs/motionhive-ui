import { Component, DestroyRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, peopleOutline } from 'ionicons/icons';
import { take } from 'rxjs';

import { AuthStore, GroupMemberRoles, GroupService, GroupsRefreshService } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { groupLinks } from '../../../../_shared/utils/stack-paths';
import { ClientGroupSheet } from '../../../groups/_sheets/client-group-sheet/client-group-sheet';
import {
  GROUP_SETUP_MIN_CLIENTS,
  groupSetupSnoozeKey,
  isGroupSetupSnoozed,
} from '../../home.config';

/**
 * "Bring your clients together": the coach Home offer of a client group
 * (design 2026-11-14), drawn as Home's other offer, the welcome card: a
 * tile, a title, one line, the card opens it and the X puts it away.
 *
 * Shown once a coach has `GROUP_SETUP_MIN_CLIENTS` active clients and runs
 * no group. The X ("Not now") hides it for 30 days on this device; nobody
 * else is told. The card opens the setup sheet, and a group made there opens.
 */
@Component({
  selector: 'mh-group-setup-card',
  imports: [ClientGroupSheet, HexAvatar, IonButton, IonIcon, TranslatePipe],
  templateUrl: './group-setup-card.html',
  styleUrl: '../welcome-card/welcome-card.scss',
})
export class GroupSetupCard {
  private readonly _authStore = inject(AuthStore);
  private readonly _groupService = inject(GroupService);
  private readonly _groupsRefresh = inject(GroupsRefreshService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _sheet = viewChild(ClientGroupSheet);

  /** The coach's active clients, from the roster Home already has. */
  readonly clientCount = input(0);

  private readonly _runsGroup = signal<boolean | null>(null);
  private readonly _snoozed = signal(false);

  readonly visible = computed(
    () =>
      this.clientCount() >= GROUP_SETUP_MIN_CLIENTS &&
      this._runsGroup() === false &&
      !this._snoozed(),
  );

  constructor() {
    addIcons({ closeOutline, peopleOutline });
    this._snoozed.set(isGroupSetupSnoozed(this._userId(), Date.now()));
    this._groupService
      .getMyGroups({ silent: true })
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (groups) =>
          this._runsGroup.set(groups.some((group) => group.myRole === GroupMemberRoles.Owner)),
        // Unknown is not "none": a failed read keeps the card away.
        error: () => this._runsGroup.set(null),
      });
  }

  open(): void {
    const sheet = this._sheet();
    if (sheet) {
      sheet.show();
    }
  }

  /** "Not now": away for 30 days, on this device only. */
  dismiss(): void {
    this._snoozed.set(true);
    try {
      localStorage.setItem(groupSetupSnoozeKey(this._userId()), String(Date.now()));
    } catch {
      // Private mode or blocked storage: it stays away until Home reloads.
    }
  }

  onCreated(groupId: string): void {
    this._runsGroup.set(true);
    this._groupsRefresh.notify();
    void this._router.navigate(groupLinks(this._router.url).group(groupId));
  }

  private _userId(): string {
    const user = this._authStore.user();
    if (!user) {
      return '';
    }
    return user.id;
  }
}
