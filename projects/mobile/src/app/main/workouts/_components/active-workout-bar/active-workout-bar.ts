import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { ActiveSessionStore } from '../../_services/active-session.store';
import {
  ACTIVE_STATUS_ICONS,
  activeStatus,
  nextWords,
  statusWords,
} from '../../_services/active-status.config';
import { workoutClock } from '../../workouts.config';
import { HexMeter, HexMeterPhases } from '../hex-meter/hex-meter';

/**
 * The workout in progress, above the tab bar on every screen but the logger
 * (Workouts R2, Active Workout), in the Hex meter design: a card floating
 * over the page with the medium ring, an icon in it and the time beside it.
 * The ring drains in honey while a rest runs, turns green with a tick once
 * it is over, and is a plain outline between sets (dashed while paused, a
 * full green ring with a trophy once every set is done). The line under the
 * title says what comes next. Tap to go back to the workout.
 */
@Component({
  selector: 'mh-active-workout-bar',
  imports: [HexMeter, IonItem, IonLabel],
  templateUrl: './active-workout-bar.html',
  styleUrl: './active-workout-bar.scss',
})
export class ActiveWorkoutBar {
  private readonly _store = inject(ActiveSessionStore);
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);

  /** The store's clock, which the resume card reads too, so their seconds agree. */
  private readonly _now = this._store.now;

  readonly session = this._store.session;

  /** The resume card reads the same answer, so the two never disagree. */
  private readonly _status = computed(() =>
    activeStatus(this.session(), this._store.rest(), this._now(), this._store.allDone()),
  );
  private readonly _rest = computed(() => this._status().rest);

  /** The rest has run out: the count is overtime now. */
  readonly over = computed(() => this._status().phase === HexMeterPhases.Over);

  /** The clock stands still, in the muted ink. */
  readonly paused = computed(() => this._status().phase === HexMeterPhases.Paused);

  /** What the ring shows. */
  readonly meterPhase = computed(() => this._status().phase);

  /** The glyph in the ring (Over draws its own tick). */
  readonly icon = computed(() => this._status().icon);

  /**
   * The workout's name alone: its clock is the figure on the right between
   * sets, so it is never said twice, and the name keeps the room at 130%.
   */
  readonly title = computed(() => this.session()?.name ?? '');

  private readonly _elapsed = computed(() => {
    const session = this.session();
    return session ? workoutClock(session, this._now()) : '';
  });

  /** "Next: Bench press · Set 3" ("Next: round 2 of 3"); empty when nothing is known to come. */
  private readonly _next = computed(() => {
    const steps = this._store.liveSteps();
    const line = this._rest()?.next || this._store.next();
    const words = nextWords(steps.length > 0 ? steps[0] : null, line);
    return words ? this._translateService.instant(words.key, words.params) : '';
  });

  /** The line under the title: what comes next, and how the rest stands. */
  readonly sub = computed(() => {
    const next = this._next();
    switch (this._status().phase) {
      case HexMeterPhases.Rest:
        return next || this._translateService.instant('workouts.restTimer.rest');
      case HexMeterPhases.Over:
        return next
          ? this._translateService.instant('workouts.activeBar.restOver', { next })
          : this._translateService.instant('workouts.restTimer.restOver');
      case HexMeterPhases.Paused:
        return this._translateService.instant('workouts.activeBar.paused');
      case HexMeterPhases.Done:
        return this._translateService.instant('workouts.live.allDone');
      default:
        return next || this._translateService.instant('workouts.activeBar.inProgress');
    }
  });

  /**
   * The number on the right: the rest counting down, then how far over it
   * is ("+0:25", as the rest timer says it: the line under the name already
   * says "Rest over"; nothing in the first second), else the workout's time.
   */
  readonly right = computed(() => {
    const status = this._status();
    if (status.phase === HexMeterPhases.Rest) {
      return status.restClock;
    }
    if (status.phase === HexMeterPhases.Over) {
      return Math.floor(-(status.rest?.left ?? 0)) > 0 ? status.restClock : '';
    }
    return this._elapsed();
  });

  /**
   * The bar's name for a screen reader, the one line of it that is read (the
   * visible parts are hidden from it): "Back to Push day. Rest · 1:02 of
   * 1:30. Next: Bench press · Set 3", in the resume card's words. It was
   * "Back to Push day" alone, so the rest and what is next were never said.
   */
  readonly label = computed(() => {
    const session = this.session();
    if (!session) return '';
    const status = this._status();
    const words = statusWords(status, this._elapsed());
    const params = {
      name: session.name,
      status: this._translateService.instant(words.key, words.params),
    };
    const next = this._next();
    // Paused and all done, the line under the name says no next either.
    const saysNext =
      next !== '' && status.phase !== HexMeterPhases.Paused && status.phase !== HexMeterPhases.Done;
    return saysNext
      ? this._translateService.instant('workouts.activeBar.openStatusNext', { ...params, next })
      : this._translateService.instant('workouts.activeBar.openStatus', params);
  });

  /** The rest still to go, as a share of the planned. */
  readonly left = computed(() => this._status().share);

  constructor() {
    addIcons(ACTIVE_STATUS_ICONS);
  }

  open(): void {
    const session = this.session();
    if (session) void this._router.navigate(['/tabs/workouts/log', session.id]);
  }
}
