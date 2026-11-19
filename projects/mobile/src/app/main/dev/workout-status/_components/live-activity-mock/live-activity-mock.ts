import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkOutline, pauseOutline } from 'ionicons/icons';

import { TIMER_HEX_SHAPE, cellFigure } from '../../../../../_shared/config/hexagon.config';
import { RestLiveState } from '../../../../../_shared/native/rest-live';
import {
  DotStates,
  LiveLayout,
  LiveLayouts,
  LivePhases,
  liveFace,
} from '../../workout-status.config';

/**
 * A picture of the iOS Live Activity, one layout at a time: the lock screen
 * (`RichView`), and the Dynamic Island expanded, compact and minimal. Drawn
 * from the same state the app sends the phone, with the layout rules of
 * `ios/App/RestTimer/RestTimerWidget.swift` ported in `liveFace`; the
 * SwiftUI is the real thing, so a change there is not seen here until the
 * port follows it. Its buttons are pictures too.
 */
@Component({
  selector: 'mh-live-activity-mock',
  imports: [IonIcon, NgTemplateOutlet],
  templateUrl: './live-activity-mock.html',
  styleUrl: './live-activity-mock.scss',
})
export class LiveActivityMock {
  readonly state = input.required<RestLiveState>();
  /** Epoch ms the phone draws it at. */
  readonly now = input.required<number>();
  readonly layout = input<LiveLayout>(LiveLayouts.Lock);

  readonly Layouts = LiveLayouts;
  readonly Phases = LivePhases;
  readonly Dots = DotStates;
  readonly hex = cellFigure(TIMER_HEX_SHAPE);

  readonly face = computed(() => liveFace(this.state(), this.now()));

  constructor() {
    addIcons({ checkmarkOutline, pauseOutline });
  }
}
