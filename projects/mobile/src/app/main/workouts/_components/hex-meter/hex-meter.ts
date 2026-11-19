import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkOutline } from 'ionicons/icons';

import {
  HEX_GEOMETRY,
  HexOrientations,
  TIMER_HEX_SHAPE,
  hexOutline,
  hexShapePath,
} from '../../../../_shared/config/hexagon.config';

/** What the ring is showing. */
export const HexMeterPhases = {
  /** A rest counting down: a honey ring draining over its pale track. */
  Rest: 'rest',
  /** The rest is over: a filled green hexagon with a tick. */
  Over: 'over',
  /** Between sets: a plain outline, no progress. */
  Workout: 'workout',
  /** The workout is paused: a dashed grey outline. */
  Paused: 'paused',
  /** Every set is logged: a full green ring, never filled, so it never reads as Over. */
  Done: 'done',
} as const;
export type HexMeterPhase = (typeof HexMeterPhases)[keyof typeof HexMeterPhases];

/** Three sizes: the island, the bars and cards, the rest timer and lock screen. */
export const HexMeterSizes = { Small: 'sm', Medium: 'md', Large: 'lg' } as const;
export type HexMeterSize = (typeof HexMeterSizes)[keyof typeof HexMeterSizes];

/** Point to point inside the 100 square, so a ring's stroke has room at the points. */
const DRAWN_HEIGHT = 92;

/** The classic hexagon on its point, centred in the 100 square, and where its ring starts. */
function meterFigure(): { d: string; start: number } {
  const { ratio } = HEX_GEOMETRY[TIMER_HEX_SHAPE];
  const width = DRAWN_HEIGHT * ratio;
  const x = (100 - width) / 2;
  const y = (100 - DRAWN_HEIGHT) / 2;
  const d = hexShapePath(TIMER_HEX_SHAPE, width, HexOrientations.Pointy, x, y);
  // The path starts just before the top point; half the first corner moves the
  // ring's start onto the point itself.
  const { length, firstCorner } = hexOutline(TIMER_HEX_SHAPE, width);
  return { d, start: length > 0 ? (firstCorner / 2 / length) * 100 : 0 };
}

const FIGURE = meterFigure();

/**
 * The Hex meter: the rest timer's hexagon, one design on every surface that
 * shows a workout in progress (mini-bar, rest timer, resume card, and the
 * lock screen mock-ups). The ring is the rest clock and nothing else: it
 * drains in honey only while a rest runs. Whatever is projected sits in the
 * middle (the time, on the large one); `icon` puts a glyph there instead.
 */
@Component({
  selector: 'mh-hex-meter',
  imports: [IonIcon],
  templateUrl: './hex-meter.html',
  styleUrl: './hex-meter.scss',
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-phase]': 'phase()',
  },
})
export class HexMeter {
  readonly phase = input.required<HexMeterPhase>();
  /** The rest still to go, as a share of the planned (0 to 1). Read only while resting. */
  readonly left = input(0);
  readonly size = input<HexMeterSize>(HexMeterSizes.Medium);
  /** An Ionicons name for the middle; Over always shows its tick. */
  readonly icon = input<string | null>(null);

  readonly Phases = HexMeterPhases;
  readonly d = FIGURE.d;
  readonly dashOffset = -FIGURE.start;

  /** The honey stroke's length out of the path's 100. */
  readonly dashArray = computed(() => {
    const share = Math.min(1, Math.max(0, this.left()));
    return `${(share * 100).toFixed(2)} 100`;
  });

  /** The glyph in the middle, if any. */
  readonly glyph = computed(() =>
    this.phase() === HexMeterPhases.Over ? 'checkmark-outline' : this.icon(),
  );

  constructor() {
    addIcons({ checkmarkOutline });
  }
}
