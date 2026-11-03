import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import { Routine, RoutineService } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { RoutineRow } from '../_components/routine-row/routine-row';
import { RoutineActionsService } from '../_services/routine-actions.service';
import { RoutineSwipes, WORKOUT_ICONS, routineTileColor } from '../workouts.config';

const ARCHIVED_LIMIT = 100;

/**
 * Your archived routines: put away, not gone. Their workouts stay in your
 * history. A swipe left unarchives one (a full swipe too), and opening one
 * offers Unarchive in its ⋯.
 */
@Component({
  selector: 'mh-archived-routines',
  imports: [
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    RoutineRow,
    TranslatePipe,
  ],
  templateUrl: './archived-routines.html',
})
export class ArchivedRoutines implements ViewWillEnter {
  private readonly _routineService = inject(RoutineService);
  private readonly _routineActionsService = inject(RoutineActionsService);
  private readonly _router = inject(Router);

  readonly routines = signal<Routine[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal(false);

  readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  readonly routineTileColor = routineTileColor;
  readonly Swipes = RoutineSwipes;

  readonly showSkeleton = computed(() => this.loading() && this.routines().length === 0);
  readonly showError = computed(() => this.error() && this.routines().length === 0);
  readonly isEmpty = computed(
    () => this.loaded() && !this.loading() && !this.error() && this.routines().length === 0,
  );

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  // Fresh each time: a routine unarchived from its page has left this list.
  ionViewWillEnter(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this._routineService
      .list({ library: 'mine', archived: 'only', limit: ARCHIVED_LIMIT })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.routines.set(page.items);
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loaded.set(true);
          this.loading.set(false);
        },
      });
  }

  open(routine: Routine): void {
    void this._router.navigate(['/tabs/workouts/routine', routine.id]);
  }

  /**
   * Back among your routines; the row leaves this list once the server
   * agrees. A tap and a full swipe on the same row send it once.
   */
  unarchive(routine: Routine): void {
    this._routineActionsService
      .setArchived(routine.id, false)
      .subscribe(() =>
        this.routines.update((routines) => routines.filter((r) => r.id !== routine.id)),
      );
  }
}
