import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonItem, IonLabel } from '@ionic/angular/standalone';

import { InstructorSearchResult } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { coachBadge, coachName, coachSubline } from '../../discover.config';
import { Highlight } from '../highlight/highlight';

/**
 * One coach in a Discover list (Coaches near you, all coaches, search), as a
 * flat-list row: hex avatar, the name, then what they coach and where with
 * one badge trailing it: Online for a coach who coaches online, else the
 * emerald "Taking clients" (silent when the door is closed: absence is the
 * signal).
 *
 * A coach without a handle has no public profile to open, so the row
 * renders inert: no press, no select.
 */
@Component({
  selector: 'mh-coach-row',
  imports: [Highlight, HexAvatar, IonBadge, IonItem, IonLabel],
  templateUrl: './coach-row.html',
  styleUrl: './coach-row.scss',
})
export class CoachRow {
  readonly coach = input.required<InstructorSearchResult>();
  /** The second line, when the list words it its own way (Coaches near you). */
  readonly line = input<string | null>(null);
  /** A search term to mark in the name and the line. */
  readonly highlight = input('');

  readonly select = output<void>();

  readonly name = computed(() => coachName(this.coach()));

  readonly subline = computed(() => this.line() ?? coachSubline(this.coach()));

  readonly badge = computed(() => coachBadge(this.coach()));

  readonly tone = computed(() => avatarToneFor(this.coach().userId));

  readonly hasProfile = computed(() => !!this.coach().handle);

  onSelect(): void {
    if (this.hasProfile()) this.select.emit();
  }
}
