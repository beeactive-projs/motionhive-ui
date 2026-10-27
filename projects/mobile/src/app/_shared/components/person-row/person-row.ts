import { Component, computed, input, output } from '@angular/core';
import { IonItem, IonLabel } from '@ionic/angular/standalone';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { RecentPerson } from '../../../../_shared/config/recent-searches.config';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';

/**
 * One person in a flat list: avatar, name, and the line under it (a handle,
 * "Your coach"). The people rows of the inbox search and the new-message
 * page, so the same person reads the same on both.
 */
@Component({
  selector: 'mh-person-row',
  imports: [HexAvatar, IonItem, IonLabel],
  templateUrl: './person-row.html',
  styleUrl: './person-row.scss',
})
export class PersonRow {
  readonly person = input.required<RecentPerson>();

  readonly select = output<void>();

  readonly tone = computed(() => avatarToneFor(this.person().id));
}
