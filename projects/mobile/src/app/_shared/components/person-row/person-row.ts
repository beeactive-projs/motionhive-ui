import { Component, computed, input, output } from '@angular/core';
import { IonButton, IonItem, IonLabel } from '@ionic/angular/standalone';

import { HexAvatar } from '../hex-avatar/hex-avatar';
import { RecentPerson } from '../../config/recent-searches.config';
import { avatarToneFor } from '../../utils/avatar-tone.utils';

/**
 * One person in a flat list: avatar, name, and the line under it (a handle,
 * "Your coach", "Invited you today"). The people rows of the inbox search,
 * the new-message page and the coaches page, so the same person reads the
 * same everywhere.
 *
 * Home's Needs you rows are people rows too, with three additions, all
 * optional, so the rows above render exactly as before:
 * - `title`: a first line that is not the name ("Elena hasn't started yet").
 * - `icon`: a tile in place of the avatar, for a row about several people.
 * - `verb`: the row's one action, a quiet button at the end (`lists.md`, the
 *   row verb). The row then takes no taps itself and emits `act`, not
 *   `select`. Where the text would be squeezed (a small phone, a large text
 *   size, a long Romanian verb) the verb moves under the text.
 */
@Component({
  selector: 'mh-person-row',
  imports: [HexAvatar, IonButton, IonItem, IonLabel],
  templateUrl: './person-row.html',
  styleUrl: './person-row.scss',
  host: { '[class.has-verb]': '!!verb()' },
})
export class PersonRow {
  readonly person = input.required<RecentPerson>();
  readonly title = input<string | null>(null);
  readonly icon = input<string | null>(null);
  readonly verb = input<string | null>(null);

  readonly select = output<void>();
  readonly act = output<void>();

  readonly tone = computed(() => avatarToneFor(this.person().id));

  /** The row is the control only when it has no verb of its own. */
  onRowClick(): void {
    if (!this.verb()) this.select.emit();
  }
}
