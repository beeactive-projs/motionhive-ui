import { Component, computed, effect, input, model, output, signal, untracked } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { addOutline, removeOutline } from 'ionicons/icons';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { secondsToClock } from '../../workouts.config';

/** Who a new rest applies to, for the rest of this workout. */
export const RestScopes = {
  /** The exercise just worked, over its plan. */
  Exercise: 'exercise',
  /** Every exercise, where nothing else sets a rest. */
  Workout: 'workout',
} as const;
export type RestScope = (typeof RestScopes)[keyof typeof RestScopes];

export interface RestChange {
  seconds: number;
  scope: RestScope;
}

/** The common rests, one tap each. */
export const REST_PRESETS = [45, 60, 90, 120, 180] as const;
const STEP_SECONDS = 15;
const MIN_SECONDS = 15;
const MAX_SECONDS = 600;

/**
 * Tap the timer: change the rest. A preset or ±15, then who it is for: this
 * exercise (over its plan) or every exercise (where nothing else sets one).
 * Only this workout changes; the plan and the person's default stay.
 */
@Component({
  selector: 'mh-rest-sheet',
  imports: [IonIcon, SheetShell, TranslatePipe],
  templateUrl: './rest-sheet.html',
  styleUrl: './rest-sheet.scss',
})
export class RestSheet {
  readonly open = model(false);
  /** The rest running now, which the sheet starts from. */
  readonly seconds = input(90);
  /** The exercise "This exercise" means; without one, only "every exercise" is offered. */
  readonly exerciseName = input('');
  /** Which choice the sheet opens on. */
  readonly initialScope = input<RestScope>(RestScopes.Exercise);

  readonly apply = output<RestChange>();

  readonly value = signal(90);
  readonly scope = signal<RestScope>(RestScopes.Exercise);
  readonly presets = REST_PRESETS;
  readonly Scopes = RestScopes;
  readonly step = STEP_SECONDS;

  readonly display = computed(() => secondsToClock(this.value()));

  constructor() {
    addIcons({ addOutline, removeOutline });
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.value.set(this.seconds());
        this.scope.set(this.exerciseName() ? this.initialScope() : RestScopes.Workout);
      });
    });
  }

  label(seconds: number): string {
    return secondsToClock(seconds);
  }

  nudge(direction: 1 | -1): void {
    this.value.update((v) => Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, v + direction * STEP_SECONDS)));
  }

  save(): void {
    this.apply.emit({ seconds: this.value(), scope: this.scope() });
    this.open.set(false);
  }
}
