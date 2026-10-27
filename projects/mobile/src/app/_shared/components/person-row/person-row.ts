import { Component, computed, input, output } from '@angular/core';
import { IonItem, IonLabel } from '@ionic/angular/standalone';

import { HexAvatar } from '../hex-avatar/hex-avatar';
import { RecentPerson } from '../../config/recent-searches.config';
import { avatarToneFor } from '../../utils/avatar-tone.utils';

/**
 * One person in a flat list: avatar, name, and the line under it (a handle,
 * "Your coach", "Invited you today"). The people rows of the inbox search,
 * the new-message page and the coaches page, so the same person reads the
 * same everywhere.
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
