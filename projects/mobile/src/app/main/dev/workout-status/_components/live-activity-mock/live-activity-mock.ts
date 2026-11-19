import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { checkmarkOutline } from 'ionicons/icons';

import { TIMER_HEX_SHAPE, cellFigure } from '../../../../../_shared/config/hexagon.config';
import { RestLiveState } from '../../../../../_shared/native/rest-live';
import {
  HexMeter,
  HexMeterPhase,
  HexMeterPhases,
} from '../../../../workouts/_components/hex-meter/hex-meter';
import { ACTIVE_STATUS_ICONS } from '../../../../workouts/_services/active-status.config';
import {
  LiveLayout,
  LiveLayouts,
  LivePhase,
  LivePhases,
  androidCardFace,
  androidLiveFace,
  liveFace,
} from '../../workout-status.config';

/** The ring for a face: draining while resting, green from zero on, a green ring when all done. */
function meterPhaseOf(phase: LivePhase, allDone: boolean): HexMeterPhase {
  switch (phase) {
    case LivePhases.Rest:
      return HexMeterPhases.Rest;
    case LivePhases.Go:
      return HexMeterPhases.Over;
    case LivePhases.Paused:
      return HexMeterPhases.Paused;
    default:
      return allDone ? HexMeterPhases.Done : HexMeterPhases.Workout;
  }
}

/**
 * A picture of the lock screen in the Hex meter design, one layout at a
 * time: the iOS lock screen, the Dynamic Island expanded, compact and
 * minimal, and the Android ongoing notification unfolded (its card under
 * Android's own header, the system's buttons under it). Drawn from the same
 * state the app sends the phone, with the layout rules of
 * `RestTimerWidget.swift` ported in `liveFace` and those of `RestLive.java`
 * in `androidLiveFace` and `androidCardFace`: when either changes, the port
 * and its spec follow, or this picture lies.
 */
@Component({
  selector: 'mh-live-activity-mock',
  imports: [HexMeter, IonIcon, NgTemplateOutlet, TranslatePipe],
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
  /** The small hexagon of the set dots and the Android header's mark. */
  readonly hex = cellFigure(TIMER_HEX_SHAPE);

  readonly face = computed(() => liveFace(this.state(), this.now()));
  /** The Android notification: its header and buttons, and the card unfolded. */
  readonly android = computed(() => androidLiveFace(this.state(), this.now()));
  readonly card = computed(() => androidCardFace(this.state(), this.now()));

  /** The iOS ring: draining while it rests, green from zero on, a trophy once all is done. */
  readonly meterPhase = computed<HexMeterPhase>(() => {
    const f = this.face();
    return meterPhaseOf(f.phase, f.allDone);
  });

  /** The Android card's ring; once all is done the clock stays inside it, no trophy. */
  readonly cardMeterPhase = computed<HexMeterPhase>(() => {
    const card = this.card();
    return meterPhaseOf(card.phase, card.allDone);
  });

  /** The glyph in a ring with no time in it. */
  readonly icon = computed(() => {
    switch (this.meterPhase()) {
      case HexMeterPhases.Rest:
        return 'timer-outline';
      case HexMeterPhases.Paused:
        return 'pause-outline';
      case HexMeterPhases.Done:
        return 'trophy-outline';
      default:
        return 'barbell-outline';
    }
  });

  /** The large ring holds the time while a clock counts; a status holds its glyph. */
  readonly timeInRing = computed(() => {
    const phase = this.meterPhase();
    return (
      phase === HexMeterPhases.Rest ||
      phase === HexMeterPhases.Paused ||
      phase === HexMeterPhases.Workout
    );
  });

  /** Under the time in the large ring: "of 1:30", "Workout", "Paused". */
  readonly caption = computed(() => {
    const f = this.face();
    const labels = this.state().labels;
    switch (f.phase) {
      case LivePhases.Rest:
        return f.aside;
      case LivePhases.Paused:
        return labels.paused;
      default:
        return labels.workout;
    }
  });

  /** Under the time in the island: "of 1:30", "7 of 13 sets", "Paused", or all done. */
  readonly islandCaption = computed(() => {
    const f = this.face();
    if (f.allDone) return this.kicker();
    return f.phase === LivePhases.Paused ? this.state().labels.paused : f.aside;
  });

  /** The kicker over the next set, as `RichView` says it: "Push day · Workout", or all done. */
  readonly kicker = computed(() => {
    const f = this.face();
    return f.allDone ? this.state().labels.allDone : f.kicker;
  });

  constructor() {
    // The ring's glyphs, and the tick on Log set and the compact island's Go.
    addIcons({ ...ACTIVE_STATUS_ICONS, checkmarkOutline });
  }
}
