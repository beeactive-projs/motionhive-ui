import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonButton, IonCard } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { InstructorSearchResult } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { DISCOVER_HEX_SHAPE } from '../../../../_shared/config/hexagon.config';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { bioQuote, coachFacts, coachName } from '../../discover.config';

/**
 * One coach in Discover's spotlight (`CoachSpotlight` turns them): the portrait
 * beside the name, specialties and years, the Taking clients badge, the
 * first sentence of their bio, then View profile and Message. The page
 * decides where both go, so the card only reports the press.
 */
@Component({
  selector: 'mh-featured-coach',
  imports: [HexAvatar, IonBadge, IonButton, IonCard, TranslatePipe],
  templateUrl: './featured-coach.html',
  styleUrl: './featured-coach.scss',
})
export class FeaturedCoach {
  readonly coach = input.required<InstructorSearchResult>();

  readonly viewProfile = output<void>();
  readonly message = output<void>();

  readonly name = computed(() => coachName(this.coach()));
  readonly facts = computed(() => coachFacts(this.coach()));
  readonly quote = computed(() => bioQuote(this.coach().bio));
  readonly tone = computed(() => avatarToneFor(this.coach().userId));
  readonly shape = DISCOVER_HEX_SHAPE;
}
