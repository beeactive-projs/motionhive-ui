import { Component, computed, input, model, output } from '@angular/core';
import {
  IonAccordion,
  IonAccordionGroup,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonToggle,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  addOutline,
  chevronForwardOutline,
  pauseOutline,
  removeOutline,
  trashOutline,
} from 'ionicons/icons';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { nudgeRest, REST_STEP_SECONDS, secondsToClock } from '../../workouts.config';

/** The switches this sheet changes, for this workout only. */
export interface LoggerPrefs {
  sound: boolean;
  vibration: boolean;
  askEffort: boolean;
}

export const LoggerOptionIds = {
  AddExercises: 'add-exercises',
  Pause: 'pause',
  Discard: 'discard',
} as const;
export type LoggerOptionId = (typeof LoggerOptionIds)[keyof typeof LoggerOptionIds];

/** The rests a workout usually takes, one tap each under the stepper. */
const REST_FOR_ALL_PRESETS = [60, 90, 120, 180, 240] as const;

/**
 * The logger's ⋯, titled with the workout's name: quick switches for this
 * workout only (the person's defaults live in Settings › Workouts), the rest
 * for every exercise, adding exercises, and the two ways out that are not
 * Finish: pause and discard. Discard, the one verb that loses work, has a
 * card of its own; every verb wears its concept's tile.
 *
 * The rest opens in place, under its row: a stepper and the usual rests.
 * Each tap applies at once, so there is nothing to confirm.
 */
@Component({
  selector: 'mh-logger-options-sheet',
  imports: [
    HexAvatar,
    IonAccordion,
    IonAccordionGroup,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonToggle,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './logger-options-sheet.html',
  styleUrl: './logger-options-sheet.scss',
})
export class LoggerOptionsSheet {
  readonly open = model(false);
  /** The workout's name, the sheet's heading; "This workout" while it has none. */
  readonly name = input('');
  readonly prefs = input.required<LoggerPrefs>();
  /** The rest every exercise gets where nothing else sets one, in seconds. */
  readonly restForAll = input(90);

  readonly prefsChange = output<Partial<LoggerPrefs>>();
  /** A new rest for every exercise, on each tap of the stepper or a preset. */
  readonly restChange = output<number>();
  readonly chosen = output<LoggerOptionId>();

  readonly Ids = LoggerOptionIds;
  readonly presets = REST_FOR_ALL_PRESETS;
  readonly step = REST_STEP_SECONDS;
  readonly restLabel = computed(() => secondsToClock(this.restForAll()));

  constructor() {
    addIcons({ addOutline, chevronForwardOutline, pauseOutline, removeOutline, trashOutline });
  }

  toggle(key: keyof LoggerPrefs, event: Event): void {
    this.prefsChange.emit({ [key]: (event as CustomEvent<{ checked: boolean }>).detail.checked });
  }

  clock(seconds: number): string {
    return secondsToClock(seconds);
  }

  nudge(direction: 1 | -1): void {
    this.restChange.emit(nudgeRest(this.restForAll(), direction));
  }

  pickRest(seconds: number): void {
    this.restChange.emit(seconds);
  }

  choose(id: LoggerOptionId): void {
    this.open.set(false);
    this.chosen.emit(id);
  }
}
