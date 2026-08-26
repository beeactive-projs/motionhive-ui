import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';

import { InstructorSearchResult } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { coachMeta, coachName, coachSpecializations } from '../../discover.config';

/**
 * One coach in a discover list: hex avatar, name with the emerald
 * "Taking clients" chip (silent when the door is closed — absence is the
 * signal), specializations, and the city · experience line.
 *
 * A coach without a handle has no public profile to open, so the row
 * renders inert — no chevron, no press.
 */
@Component({
  selector: 'mh-coach-row',
  imports: [HexAvatar, IonBadge, IonItem, IonLabel, IonNote],
  templateUrl: './coach-row.html',
  styleUrl: './coach-row.scss',
})
export class CoachRow {
  readonly coach = input.required<InstructorSearchResult>();

  readonly select = output<void>();

  readonly name = computed(() => coachName(this.coach()));

  readonly meta = computed(() => coachMeta(this.coach()));

  readonly specializations = computed(() => coachSpecializations(this.coach()));

  readonly tone = computed(() => avatarToneFor(this.coach().userId));

  readonly hasProfile = computed(() => !!this.coach().handle);

  onSelect(): void {
    if (this.hasProfile()) this.select.emit();
  }
}
