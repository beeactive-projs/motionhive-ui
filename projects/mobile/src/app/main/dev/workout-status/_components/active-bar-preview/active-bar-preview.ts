import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { ActiveWorkoutBar } from '../../../../workouts/_components/active-workout-bar/active-workout-bar';
import {
  ActiveRest,
  ActiveSession,
  ActiveSessionStore,
} from '../../../../workouts/_services/active-session.store';

/** All the bar reads from the store. */
export type PreviewSessionSource = Pick<ActiveSessionStore, 'session' | 'rest'>;

/** The mock workout behind the bar is no real log: a tap goes nowhere. */
const INERT_ROUTER: Pick<Router, 'navigate'> = { navigate: () => Promise.resolve(false) };

/**
 * The real `mh-active-workout-bar`, on mock data: it reads the session and
 * the rest given here instead of the app's `ActiveSessionStore`, so several
 * can show different states side by side.
 */
@Component({
  selector: 'mh-active-bar-preview',
  imports: [ActiveWorkoutBar],
  templateUrl: './active-bar-preview.html',
  providers: [
    {
      provide: ActiveSessionStore,
      useFactory: (): PreviewSessionSource => inject(ActiveBarPreview).source,
    },
    { provide: Router, useValue: INERT_ROUTER },
  ],
})
export class ActiveBarPreview {
  readonly session = input.required<ActiveSession | null>();
  readonly rest = input<ActiveRest | null>(null);

  /** What the bar takes for the store. */
  readonly source: PreviewSessionSource = { session: this.session, rest: this.rest };
}
