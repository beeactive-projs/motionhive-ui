import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import { Routine, RoutineService } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { RoutineRow } from '../_components/routine-row/routine-row';
import { WORKOUT_ICONS, routineTone } from '../workouts.config';

/**
 * The MotionHive starter routines — owned by nobody, runnable by anyone.
 *
 * Starting one deep-copies it into your own library, which the sub-header
 * says up front: a user who tries one should not be surprised later to find
 * it sitting among the routines they wrote themselves.
 */
@Component({
  selector: 'mh-starters',
  imports: [
    EmptyState,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    RoutineRow,
  ],
  templateUrl: './starters.html',
  styleUrl: './starters.scss',
})
export class Starters implements ViewWillEnter {
  private readonly _routineService = inject(RoutineService);
  private readonly _router = inject(Router);

  readonly routines = signal<Routine[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly failed = signal(false);

  readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  readonly routineTone = routineTone;

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  ionViewWillEnter(): void {
    if (this.loaded()) return;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this._routineService
      .list({ library: 'system', limit: 50 })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.routines.set(page.items);
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loaded.set(true);
          this.loading.set(false);
        },
      });
  }

  open(routine: Routine): void {
    void this._router.navigate(['/tabs/workouts/routine', routine.id]);
  }
}
