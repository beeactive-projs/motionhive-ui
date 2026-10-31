import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { InstructorSearchResult } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { coachName, coachSubline } from '../../discover.config';

/**
 * One coach in a Discover list (search, all coaches), as a flat-list row:
 * hex avatar, the name, then the city and what they coach with the emerald
 * "Taking clients" badge trailing it (silent when the door is closed:
 * absence is the signal).
 *
 * A coach without a handle has no public profile to open, so the row
 * renders inert: no press, no select.
 */
@Component({
  selector: 'mh-coach-row',
  imports: [HexAvatar, IonBadge, IonItem, IonLabel, TranslatePipe],
  templateUrl: './coach-row.html',
  styleUrl: './coach-row.scss',
})
export class CoachRow {
  readonly coach = input.required<InstructorSearchResult>();

  readonly select = output<void>();

  readonly name = computed(() => coachName(this.coach()));

  readonly subline = computed(() => coachSubline(this.coach()));

  readonly tone = computed(() => avatarToneFor(this.coach().userId));

  readonly hasProfile = computed(() => !!this.coach().handle);

  onSelect(): void {
    if (this.hasProfile()) this.select.emit();
  }
}
