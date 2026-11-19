import { Component, computed, input, output } from '@angular/core';
import { IonButton, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { SetProgress } from '../../_services/active-session.store';
import {
  ACTIVE_STATUS_ICONS,
  ActiveStatus,
  activeStatus,
  statusWords,
} from '../../_services/active-status.config';
import { HexMeter, HexMeterPhases } from '../hex-meter/hex-meter';

/** Running, between sets: what the card shows until it is told more. */
const RUNNING = activeStatus(null, null, 0);

/**
 * The workout left open, at the top of the Workouts tab, in the Hex meter
 * design: a card with the medium ring, its name, how it stands and one honey
 * button. The ring says what the mini-bar's does (`activeStatus`), and the
 * line under the name says it in words: "Workout · 23:00 · 7 of 13 sets",
 * "Rest · 1:02 of 1:30", "Rest over · +0:25 over", "Paused · 23:00",
 * "All sets done · 52:00". The button is Resume, Continue while paused, and
 * Finish workout once every set is ticked. It outranks everything else on
 * the page.
 */
@Component({
  selector: 'mh-resume-card',
  imports: [HexMeter, IonButton, IonItem, IonLabel, IonList, TranslatePipe],
  templateUrl: './resume-card.html',
  styleUrl: './resume-card.scss',
})
export class ResumeCard {
  readonly name = input.required<string>();
  /** "31:40", as `workoutClock` says it. */
  readonly elapsed = input.required<string>();
  /** How the workout stands, as the mini-bar reads it. */
  readonly status = input<ActiveStatus>(RUNNING);
  /** Sets ticked of how many; null until the logger has counted them. */
  readonly progress = input<SetProgress | null>(null);

  readonly resume = output<void>();
  /** Every set is ticked and Finish workout was tapped. */
  readonly finish = output<void>();

  /** A paused workout's clock stands still, so the card says why. */
  readonly paused = computed(() => this.status().phase === HexMeterPhases.Paused);
  /** Every set is ticked: what is left is to finish. */
  readonly done = computed(() => this.status().phase === HexMeterPhases.Done);
  readonly meterPhase = computed(() => this.status().phase);
  readonly icon = computed(() => this.status().icon);
  /** The rest still to go, as a share of the planned. */
  readonly left = computed(() => this.status().share);
  /** The line is green once the rest is over or every set is done, as its ring is. */
  readonly ok = computed(() => this.done() || this.status().phase === HexMeterPhases.Over);

  readonly buttonKey = computed(() => {
    if (this.paused()) return 'button.continue';
    if (this.done()) return 'workouts.home.finish';
    return 'button.resume';
  });

  /** The line under the name, in the words the mini-bar speaks too. */
  readonly meta = computed(() => statusWords(this.status(), this.elapsed(), this.progress()));

  constructor() {
    addIcons(ACTIVE_STATUS_ICONS);
  }

  /** The one button: Finish once every set is done, else back to the workout. */
  act(): void {
    if (this.done()) {
      this.finish.emit();
      return;
    }
    this.resume.emit();
  }
}
