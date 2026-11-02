import { Component, input, model, output } from '@angular/core';
import { IonIcon, IonItem, IonLabel, IonList, IonNote, IonToggle } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { pauseOutline, timeOutline, trashOutline } from 'ionicons/icons';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';

/** The switches this sheet changes, for this workout only. */
export interface LoggerPrefs {
  sound: boolean;
  vibration: boolean;
  askEffort: boolean;
}

export const LoggerOptionIds = {
  RestForAll: 'rest-for-all',
  Pause: 'pause',
  Discard: 'discard',
} as const;
export type LoggerOptionId = (typeof LoggerOptionIds)[keyof typeof LoggerOptionIds];

/**
 * The logger's ⋯: quick switches for this workout only (the person's
 * defaults live in Settings › Workouts), the rest for every exercise, and
 * the two ways out that are not Finish: pause and discard.
 */
@Component({
  selector: 'mh-logger-options-sheet',
  imports: [IonIcon, IonItem, IonLabel, IonList, IonNote, IonToggle, SheetShell, TranslatePipe],
  templateUrl: './logger-options-sheet.html',
})
export class LoggerOptionsSheet {
  readonly open = model(false);
  readonly prefs = input.required<LoggerPrefs>();
  /** "1:30": the rest every exercise gets where nothing else sets one. */
  readonly restForAll = input('');

  readonly prefsChange = output<Partial<LoggerPrefs>>();
  readonly chosen = output<LoggerOptionId>();

  readonly Ids = LoggerOptionIds;

  constructor() {
    addIcons({ pauseOutline, timeOutline, trashOutline });
  }

  toggle(key: keyof LoggerPrefs, event: Event): void {
    this.prefsChange.emit({ [key]: (event as CustomEvent<{ checked: boolean }>).detail.checked });
  }

  choose(id: LoggerOptionId): void {
    this.open.set(false);
    this.chosen.emit(id);
  }
}
