import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonSkeletonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { MessagingStore, UserSearchResult, displayName } from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { AvatarTone, avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { injectPeopleSearch } from '../../../../_shared/utils/people-search';
import { MESSAGING_ICONS } from '../../messages.config';

/**
 * "New message" — search for someone, tap them, start writing.
 *
 * Picking creates nothing. It routes to the draft chat, and the BE creates the
 * conversation on the first send, so an abandoned pick leaves no empty thread
 * in the inbox.
 *
 * Open state lives on `MessagingStore.composeMode` rather than a local flag, so
 * the store can close the sheet itself once a send lands.
 */
@Component({
  selector: 'mh-new-message-sheet',
  imports: [
    EmptyState,
    HexAvatar,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSearchbar,
    IonSkeletonText,
    SheetShell,
  ],
  templateUrl: './new-message-sheet.html',
})
export class NewMessageSheet {
  private readonly _router = inject(Router);
  readonly store = inject(MessagingStore);

  readonly people = injectPeopleSearch();
  readonly skeletonRows = [1, 2, 3, 4];

  /** `mh-sheet-shell` takes a `model`, so this bridges it to the store flag. */
  readonly open = signal(false);

  private readonly _sheet = viewChild(SheetShell);

  constructor() {
    addIcons(MESSAGING_ICONS);

    effect(() => this.open.set(this.store.composeMode()));

    // Swipe-to-dismiss and the close button only move the local signal.
    effect(() => {
      if (this.open()) return;
      if (this.store.composeMode()) this.store.exitComposeMode();
      this.people.clear();
    });
  }

  async openPerson(person: UserSearchResult): Promise<void> {
    const existing = this.store.findDirectWith(person.id);

    // Close and wait before navigating: routing away detaches this page's view
    // from change detection, so a signal-driven close never gets applied and
    // the sheet would sit on top of the chat.
    await this._sheet()?.close();
    this.store.exitComposeMode();

    if (existing) {
      this.store.openConversation(existing.id);
      return;
    }

    void this._router.navigate(['/tabs/messages/new'], {
      queryParams: { to: person.id, name: this.nameOf(person) },
    });
  }

  nameOf(person: UserSearchResult): string {
    return displayName(person);
  }

  toneFor(id: string): AvatarTone {
    return avatarToneFor(id);
  }
}
