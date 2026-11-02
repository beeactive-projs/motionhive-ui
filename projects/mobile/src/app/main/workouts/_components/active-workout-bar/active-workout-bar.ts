import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { TIMER_HEX_SHAPE, cellFigure } from '../../../../_shared/config/hexagon.config';
import { ActiveSessionStore } from '../../_services/active-session.store';
import { secondsToClock, workoutClock } from '../../workouts.config';
import { OVERTIME_CEILING_SECONDS } from '../rest-timer-bar/rest-timer-bar';

/**
 * The workout in progress, above the tab bar on every screen but the logger
 * (Workouts R2, Active Workout). One timer design everywhere: a filled
 * hexagon that drains is rest, counting down; an outline one is the
 * workout's own time, counting up. Never both. Tap to go back to it.
 */
@Component({
  selector: 'mh-active-workout-bar',
  imports: [TranslatePipe],
  templateUrl: './active-workout-bar.html',
  styleUrl: './active-workout-bar.scss',
})
export class ActiveWorkoutBar {
  private readonly _store = inject(ActiveSessionStore);
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);

  readonly hex = cellFigure(TIMER_HEX_SHAPE);
  readonly clipId = `active-hex-${Math.random().toString(36).slice(2, 8)}`;

  private readonly _now = signal(Date.now());

  readonly session = this._store.session;

  /** The rest, while it still counts as one (ten minutes of overtime at most). */
  private readonly _rest = computed(() => {
    const rest = this._store.rest();
    const session = this.session();
    if (!rest || !session || rest.logId !== session.id || rest.endsAt === null) return null;
    const left = (rest.endsAt - this._now()) / 1000;
    return left < -OVERTIME_CEILING_SECONDS ? null : { ...rest, left };
  });

  readonly resting = computed(() => this._rest() !== null);

  readonly title = computed(() => {
    const session = this.session();
    if (!session) return '';
    return `${session.name} · ${workoutClock(session, this._now())}`;
  });

  readonly sub = computed(() => {
    const rest = this._rest();
    const session = this.session();
    if (rest) {
      return this._translateService.instant(
        rest.left > 0 ? 'workouts.activeBar.resting' : 'workouts.activeBar.restDone',
        { next: rest.next },
      );
    }
    return this._translateService.instant(
      session?.pausedAt ? 'workouts.activeBar.paused' : 'workouts.activeBar.inProgress',
    );
  });

  /** The number on the right: the rest, or the workout's time. */
  readonly right = computed(() => {
    const rest = this._rest();
    if (rest) {
      return rest.left > 0
        ? secondsToClock(Math.ceil(rest.left))
        : `+${secondsToClock(Math.floor(-rest.left))}`;
    }
    const session = this.session();
    return session ? workoutClock(session, this._now()) : '';
  });

  private readonly _fill = computed(() => {
    const rest = this._rest();
    if (!rest || rest.planned <= 0) return 0;
    return Math.min(1, Math.max(0, rest.left / rest.planned));
  });

  readonly fillHeight = computed(() => this.hex.height * this._fill());
  readonly fillY = computed(() => this.hex.y + this.hex.height - this.fillHeight());

  constructor() {
    const handle = setInterval(() => this._now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(handle));
  }

  open(): void {
    const session = this.session();
    if (session) void this._router.navigate(['/tabs/workouts/log', session.id]);
  }
}
