import { Component, computed, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToggle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { timeOutline } from 'ionicons/icons';

import { WorkoutSettings } from 'core';

import { ChoiceSheet } from '../../../_shared/components/choice-sheet/choice-sheet';
import { SettingsRow } from '../../../_shared/components/settings-row/settings-row';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { WorkoutSettingsStore } from '../../workouts/_services/workout-settings.store';
import { secondsToClock } from '../../workouts/workouts.config';
import { restChoices } from './workout-settings.config';

type ToggleKey = keyof Pick<
  WorkoutSettings,
  'sound' | 'vibration' | 'askEffort' | 'supersetJump' | 'keepScreenOn'
>;

/**
 * Settings › Workouts: how the logger behaves for this person, on every
 * phone they use. Each switch saves at once. The plan's own rests and
 * target efforts still win where a coach or a routine sets them.
 */
@Component({
  selector: 'mh-workout-settings',
  imports: [
    ChoiceSheet,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonTitle,
    IonToggle,
    IonToolbar,
    SettingsRow,
    TranslatePipe,
  ],
  templateUrl: './workout-settings.html',
})
export class WorkoutSettingsPage implements ViewWillEnter {
  private readonly _store = inject(WorkoutSettingsStore);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly settings = this._store.settings;
  readonly restOpen = signal(false);

  readonly restLabel = computed(() => secondsToClock(this.settings().defaultRestSeconds));
  readonly restOptions = computed(() => restChoices(this.settings().defaultRestSeconds));

  constructor() {
    addIcons({ timeOutline });
  }

  ionViewWillEnter(): void {
    this._store.load();
  }

  toggle(key: ToggleKey, event: Event): void {
    const checked = (event as CustomEvent<{ checked: boolean }>).detail.checked;
    this._store.update({ [key]: checked }, () => this._saveFailed());
  }

  pickRest(value: string): void {
    this._store.update({ defaultRestSeconds: Number(value) }, () => this._saveFailed());
  }

  private _saveFailed(): void {
    void this._feedbackService.error(
      null,
      this._translateService.instant('account.workoutSettings.saveFailed'),
    );
  }
}
