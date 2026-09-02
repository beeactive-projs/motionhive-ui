import { Component, computed, input, output } from '@angular/core';
import { IonIcon, IonItem, IonLabel } from '@ionic/angular/standalone';

import { RosterClient } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { attentionLabel, attentionStat, attentionTone } from '../../clients.config';

/**
 * One flagged client on the triage lens: the settled spine card, with the
 * spine keyed to the reason rather than to a session type — red for a plan
 * that is slipping, amber for one never started, sky for someone gone quiet.
 * The right-hand block carries the one number that explains the flag.
 */
@Component({
  selector: 'mh-attention-row',
  imports: [HexAvatar, IonIcon, IonItem, IonLabel],
  templateUrl: './attention-row.html',
  styleUrl: './attention-row.scss',
  host: {
    '[attr.data-tone]': 'tone()',
  },
})
export class AttentionRow {
  readonly client = input.required<RosterClient>();

  readonly select = output<void>();

  /** Drives the spine and the reason line's ink via `data-tone`. */
  readonly tone = computed(() => attentionTone(this.client().attention));

  readonly avatarTone = computed(() => avatarToneFor(this.client().clientId));

  readonly reason = computed(() => attentionLabel(this.client()));

  readonly stat = computed(() => attentionStat(this.client()));
}
