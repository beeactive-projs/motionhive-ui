import { Component, computed, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { InstructorClient, clientDisplayName, clientEmail, clientStatusLabel } from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { ClockService } from '../../../_shared/services/clock.service';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { AvatarTone, avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { InviteClientSheet } from '../_sheets/invite-client-sheet/invite-client-sheet';
import { CLIENT_ICONS, receivedLabel, sentMetaLabel } from '../clients.config';
import { RequestsStore } from './requests.store';

/**
 * Who is waiting on whom: incoming requests first, because they need a
 * decision, then the invitations the coach sent, which only need patience —
 * a resend, or a withdrawal.
 *
 * Accept and decline fire on the tap, as they do on web: both are the point
 * of the row, and a request can be sent again. Withdrawing an invitation
 * asks first — the address on the other end has a link that stops working.
 */
@Component({
  selector: 'mh-requests',
  imports: [
    ConfirmSheet,
    EmptyState,
    HexAvatar,
    InviteClientSheet,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonCard,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './requests.html',
  styleUrl: './requests.scss',
  providers: [RequestsStore],
})
export class Requests implements ViewWillEnter {
  readonly store = inject(RequestsStore);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _clockService = inject(ClockService);

  readonly skeletonRows = [1, 2, 3];

  readonly inviteOpen = signal(false);

  readonly withdrawOpen = signal(false);
  readonly withdrawing = signal<InstructorClient | null>(null);
  readonly withdrawSaving = signal(false);

  readonly withdrawBody = computed(() => {
    const row = this.withdrawing();
    const who = row ? clientDisplayName(row, 'this person') : 'this person';
    return `${who} will no longer be able to accept it. You can invite them again later.`;
  });

  constructor() {
    addIcons(CLIENT_ICONS);
  }

  // Not ngOnInit: the page lives in the tab stack, and a request answered
  // from a notification should be gone when this screen comes back.
  ionViewWillEnter(): void {
    this._clockService.bump();
    this.store.load({ force: true });
  }

  name(row: InstructorClient): string {
    return clientDisplayName(row);
  }

  email(row: InstructorClient): string {
    return clientEmail(row);
  }

  statusLabel(row: InstructorClient): string {
    return clientStatusLabel(row);
  }

  toneFor(row: InstructorClient): AvatarTone {
    return avatarToneFor(row.clientId ?? row.id);
  }

  received(row: InstructorClient): string {
    return receivedLabel(row.createdAt, this._clockService.now());
  }

  sentMeta(row: InstructorClient): string {
    return sentMetaLabel(row, this._clockService.now());
  }

  accept(row: InstructorClient): void {
    this.store.accept(row).subscribe({
      next: () => void this._feedbackService.success('Request accepted'),
      error: (error: unknown) =>
        void this._feedbackService.error(error, 'Could not update this request.'),
    });
  }

  decline(row: InstructorClient): void {
    this.store.decline(row).subscribe({
      next: () => void this._feedbackService.success('Request declined'),
      error: (error: unknown) =>
        void this._feedbackService.error(error, 'Could not update this request.'),
    });
  }

  resend(row: InstructorClient): void {
    this.store.resend(row).subscribe({
      next: () => void this._feedbackService.success('Invitation resent'),
      error: (error: unknown) =>
        void this._feedbackService.error(error, 'Could not resend the invitation.'),
    });
  }

  confirmWithdraw(row: InstructorClient): void {
    this.withdrawing.set(row);
    this.withdrawOpen.set(true);
  }

  withdraw(): void {
    const row = this.withdrawing();
    if (!row || this.withdrawSaving()) return;

    this.withdrawSaving.set(true);
    this.store.withdraw(row).subscribe({
      next: () => {
        this.withdrawSaving.set(false);
        this.withdrawOpen.set(false);
        void this._feedbackService.success('Invitation withdrawn');
      },
      error: (error: unknown) => {
        this.withdrawSaving.set(false);
        void this._feedbackService.error(error, 'Could not withdraw the invitation.');
      },
    });
  }

  openInvite(): void {
    this.inviteOpen.set(true);
  }

  onInviteSent(): void {
    this.store.refresh();
  }

  onRefresh(event: RefresherCustomEvent): void {
    this._clockService.bump();
    this.store.refresh(() => void event.target.complete());
  }

  retry(): void {
    this.store.refresh();
  }
}
