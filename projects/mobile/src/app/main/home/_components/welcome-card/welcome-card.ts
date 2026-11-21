import { Component, computed, inject, input } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { NavModes } from 'core';
import type { NavMode } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { OnboardingStateService } from '../../../../_shared/services/onboarding-state.service';
import { WelcomeCardEntry, welcomeCards } from '../../home.config';
import { HOME_ICONS } from '../../home.icons';

/**
 * The welcome flow's questions someone passed over, offered again on Home:
 * "Tell us what you like to train" in Train mode, "Finish your coach profile"
 * in Coach mode, and "Complete your profile" for a passed over About you, a
 * card of its own. A tap opens the flow on just that card's steps; the X
 * closes the card for good. Nothing renders once there is nothing to ask.
 */
@Component({
  selector: 'mh-welcome-card',
  imports: [HexAvatar, IonButton, IonIcon, TranslatePipe],
  templateUrl: './welcome-card.html',
  styleUrl: './welcome-card.scss',
})
export class WelcomeCard {
  private readonly _onboarding = inject(OnboardingStateService);

  /** The Home it sits on. */
  readonly kind = input.required<NavMode>();

  readonly steps = computed(() => {
    if (this.kind() === NavModes.Coach) {
      return this._onboarding.coachCard();
    }
    return this._onboarding.trainCard();
  });

  readonly cards = computed(() => welcomeCards(this.kind(), this.steps()));

  constructor() {
    addIcons(HOME_ICONS);
    void this._onboarding.ensureLoaded();
  }

  open(card: WelcomeCardEntry): void {
    this._onboarding.open(card.steps);
  }

  dismiss(card: WelcomeCardEntry): void {
    this._onboarding.dismiss(card.steps);
  }
}
