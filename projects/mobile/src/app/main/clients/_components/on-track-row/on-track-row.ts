import { Component, computed, input, output } from '@angular/core';
import { IonIcon, IonItem, IonLabel } from '@ionic/angular/standalone';

import { RosterClient } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { onTrackStat, subtitleFor } from '../../clients.config';

/**
 * One client who needs nothing this week: a plain card-list row, adherence
 * in green on the right. No spine — there is no reason to colour by.
 */
@Component({
  selector: 'mh-on-track-row',
  imports: [HexAvatar, IonIcon, IonItem, IonLabel],
  templateUrl: './on-track-row.html',
  styleUrl: './on-track-row.scss',
})
export class OnTrackRow {
  readonly client = input.required<RosterClient>();

  readonly select = output<void>();

  readonly avatarTone = computed(() => avatarToneFor(this.client().clientId));

  readonly subtitle = computed(() => subtitleFor(this.client()));

  readonly stat = computed(() => onTrackStat(this.client()));
}
