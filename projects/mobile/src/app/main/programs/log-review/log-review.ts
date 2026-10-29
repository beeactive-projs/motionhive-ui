import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonCard,
  IonCardContent,
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

import { LoggedExercise, WorkoutLog, WorkoutLogService } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { StatTile } from '../../../_shared/components/stat-tile/stat-tile';
import {
  exerciseSetSummary,
  workoutDuration,
  workoutTiles,
} from '../../workouts/workouts.config';
import { coachStackOf } from '../../clients/client-paths';
import { PROGRAM_ICONS } from '../programs.config';

/**
 * One of a client's workouts, as the coach sees it.
 *
 * Read-only by construction — this is a record of what someone did, and the
 * coach's job here is to read it, not to correct it. It deliberately mirrors
 * the trainee's own summary, down to the same tile maths, so the two are
 * talking about the same thing.
 */
@Component({
  selector: 'mh-log-review',
  imports: [
    EmptyState,
    IonBackButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    StatTile,
    TranslatePipe,
  ],
  templateUrl: './log-review.html',
  styleUrl: './log-review.scss',
})
export class LogReview implements ViewWillEnter {
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  /** Mounted under Clients and Programs; back on a cold load stays in that tab. */
  readonly backHref = coachStackOf(this._router.url);

  private readonly _destroyRef = inject(DestroyRef);

  readonly log = signal<WorkoutLog | null>(null);
  /** The workout's photo as an object URL; the bytes only come through the API. */
  readonly photoUrl = signal<string | null>(null);
  /** Which photo `photoUrl` holds, so coming back does not download it again. */
  private _photoKey: string | null = null;
  readonly loading = signal(false);
  readonly error = signal(false);

  readonly skeletonTiles = [1, 2, 3];

  readonly showSkeleton = computed(() => this.loading() && !this.log());
  readonly showError = computed(() => this.error() && !this.log());

  readonly durationLabel = computed(
    () => workoutDuration(this.log()?.durationSeconds) || '—',
  );

  readonly exercises = computed<LoggedExercise[]>(() => this.log()?.exercises ?? []);

  /** Only the modalities this session actually contained. */
  readonly tiles = computed(() => {
    const log = this.log();
    return log ? workoutTiles(log) : [];
  });

  readonly hasFeedback = computed(() => !!this.log()?.feelingRating || !!this.log()?.notes);

  constructor() {
    addIcons(PROGRAM_ICONS);
    this._destroyRef.onDestroy(() => this._dropPhoto());
  }

  ionViewWillEnter(): void {
    this.load();
  }

  load(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) return;

    this.loading.set(true);
    this.error.set(false);
    this._workoutLogService
      .getForCoach(id)
      .pipe(take(1))
      .subscribe({
        next: (log) => {
          this.log.set(log);
          this.loading.set(false);
          this._loadPhoto(log);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  setSummary(exercise: LoggedExercise): string {
    return exerciseSetSummary(exercise);
  }

  /** Quiet on failure: the workout stands without its picture. */
  private _loadPhoto(log: WorkoutLog): void {
    if (!log.hasPhoto) {
      this._dropPhoto();
      return;
    }
    const key = `${log.id}:${log.photoVersion ?? ''}`;
    if (key === this._photoKey && this.photoUrl()) return;
    this._workoutLogService
      .getPhotoForCoach(log.id)
      // Landing after the page is gone would make a URL nothing revokes.
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (blob) => {
          this._dropPhoto();
          this.photoUrl.set(URL.createObjectURL(blob));
          this._photoKey = key;
        },
        error: () => undefined,
      });
  }

  private _dropPhoto(): void {
    const url = this.photoUrl();
    if (url) URL.revokeObjectURL(url);
    this.photoUrl.set(null);
    this._photoKey = null;
  }
}
