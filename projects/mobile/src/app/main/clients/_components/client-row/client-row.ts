import { Component, computed, input, output } from '@angular/core';
import {
  IonBadge,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
} from '@ionic/angular/standalone';

import {
  InstructorClient,
  InstructorClientStatuses,
  clientDisplayName,
  clientStatusLabel,
  isIncomingRequest,
  isOpenableClient,
  isSentInvite,
} from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { clientStatusTone, clientSubline } from '../../clients.config';

/**
 * One row of the All clients list: hex avatar, name, email, and a status chip
 * only where the status is worth saying. Active is the default state and stays
 * chip-silent, like a booked session; pending and archived wear a wash.
 *
 * Swiping reveals the verbs the row can take — Message on the leading edge,
 * Notes and Archive (or Unarchive, or Withdraw for an invitation) on the
 * trailing one. An incoming request has none: its verbs are a decision, and
 * those live on the Requests page. The row only emits; the page owns the
 * store calls and the confirmations.
 *
 * An email-only invite has no account behind it — no avatar to show, no
 * profile to open, nobody to message — so it gets a mail tile and stays inert.
 */
@Component({
  selector: 'mh-client-row',
  imports: [
    HexAvatar,
    IonBadge,
    IonIcon,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonLabel,
  ],
  templateUrl: './client-row.html',
  styleUrl: './client-row.scss',
})
export class ClientRow {
  readonly client = input.required<InstructorClient>();

  readonly select = output<void>();
  readonly message = output<void>();
  readonly notes = output<void>();
  readonly archive = output<void>();
  readonly unarchive = output<void>();
  readonly withdraw = output<void>();

  readonly name = computed(() => clientDisplayName(this.client()));

  readonly subline = computed(() => clientSubline(this.client()));

  readonly statusLabel = computed(() => clientStatusLabel(this.client()));

  readonly statusTone = computed(() => clientStatusTone(this.client()));

  /** Has a profile to push to. */
  readonly openable = computed(() => isOpenableClient(this.client()));

  readonly isIncoming = computed(() => isIncomingRequest(this.client()));

  /** Openable, or an incoming request — which the page routes to Requests. */
  readonly pressable = computed(() => this.openable() || this.isIncoming());

  readonly isActive = computed(
    () => this.client().status === InstructorClientStatuses.Active,
  );

  readonly isArchived = computed(
    () => this.client().status === InstructorClientStatuses.Archived,
  );

  readonly isInvite = computed(() => isSentInvite(this.client()));

  readonly isEmailOnly = computed(() => !this.client().client);

  /** Someone with an account, and not a request still waiting on the coach. */
  readonly canMessage = computed(() => !this.isEmailOnly() && !this.isIncoming());

  readonly hasTrailing = computed(
    () => this.isActive() || this.isArchived() || this.isInvite(),
  );

  readonly avatarTone = computed(() =>
    avatarToneFor(this.client().clientId ?? this.client().id),
  );

  onSelect(): void {
    if (this.pressable()) this.select.emit();
  }

  /**
   * Ionic leaves the row open after an option is tapped, so the next render
   * shows a half-swiped row with stale buttons.
   */
  emitAndClose(sliding: IonItemSliding, action: { emit: () => void }): void {
    action.emit();
    void sliding.close();
  }
}
