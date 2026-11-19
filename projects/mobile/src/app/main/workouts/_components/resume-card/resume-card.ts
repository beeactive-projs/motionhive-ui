import { Component, computed, input, output } from '@angular/core';
import { IonButton, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { pauseOutline, timeOutline } from 'ionicons/icons';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';

/**
 * The workout left open, at the top of the Workouts tab: a navy card with
 * a coral time tile (a pause sign while paused), how long it has run, its
 * name and Resume. It outranks everything else on the page.
 */
@Component({
  selector: 'mh-resume-card',
  imports: [HexAvatar, IonButton, IonItem, IonLabel, IonList, TranslatePipe],
  templateUrl: './resume-card.html',
  styleUrl: './resume-card.scss',
})
export class ResumeCard {
  readonly name = input.required<string>();
  /** "31:40", as `workoutClock` says it. */
  readonly elapsed = input.required<string>();
  /** A paused workout's clock stands still, so the card says why. */
  readonly paused = input(false);

  readonly resume = output<void>();

  /** The tile's glyph: the clock running, or stopped. */
  readonly icon = computed(() => (this.paused() ? 'pause-outline' : 'time-outline'));

  constructor() {
    addIcons({ pauseOutline, timeOutline });
  }
}
