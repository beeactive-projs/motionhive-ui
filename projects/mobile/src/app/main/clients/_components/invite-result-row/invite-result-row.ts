import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonButton, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { UserSearchResult, displayName } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { InviteRowState, InviteRowStates } from '../../invite.utils';

/**
 * One search result on the invite page: avatar, name, and an Invite button
 * that sends the invitation.
 *
 * The button is the only control: the row itself does not take taps, so a
 * screen reader meets one "Invite Elena Dumitru" per person rather than a row
 * and a button for the same action (user decision, 2026-10-27, replacing a
 * tappable row with a badge). Once sent, the button gives way to a badge,
 * since "Sending" and "Invited" are states, not things to press.
 *
 * Takes a raw `UserSearchResult` rather than a `RecentPerson`: nothing here is
 * a recent search, and the extra mapping step would only hide the handle.
 */
@Component({
  selector: 'mh-invite-result-row',
  imports: [HexAvatar, IonBadge, IonButton, IonItem, IonLabel, TranslatePipe],
  templateUrl: './invite-result-row.html',
  styleUrl: './invite-result-row.scss',
})
export class InviteResultRow {
  readonly person = input.required<UserSearchResult>();
  readonly state = input<InviteRowState>(InviteRowStates.Idle);

  readonly invite = output<void>();

  readonly name = computed(() => displayName(this.person()));

  readonly handle = computed(() => {
    const tag = this.person().handle;
    return tag ? `@${tag}` : null;
  });

  readonly tone = computed(() => avatarToneFor(this.person().id));

  readonly isIdle = computed(() => this.state() === InviteRowStates.Idle);

  readonly statusLabel = computed(() =>
    this.state() === InviteRowStates.Invited ? 'clients.invite.invited' : 'clients.invite.sending',
  );

  /**
   * Green once sent; neutral before, so the row does not flash green before
   * the API has agreed.
   */
  readonly statusTone = computed(() =>
    this.state() === InviteRowStates.Invited ? 'success' : 'medium',
  );
}
