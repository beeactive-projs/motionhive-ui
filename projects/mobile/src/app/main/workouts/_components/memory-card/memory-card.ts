import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { take } from 'rxjs';

import { WorkoutMemory } from 'core';

import { WorkoutPhotoStore } from '../../_services/workout-photo';
import { formatMeasure, memoryWhen } from '../../workouts.config';

/**
 * History's memory: a workout from a while back, its photo when it has
 * one, and how far one of its lifts has come since ("Squat: 80 → 100 kg").
 * Navy with the finish screen's honeycomb when there is no photo; under a
 * photo, a navy fade keeps the words readable. Only ever real progress:
 * the API sends no memory without it.
 */
@Component({
  selector: 'mh-memory-card',
  imports: [TranslatePipe],
  templateUrl: './memory-card.html',
  styleUrl: './memory-card.scss',
})
export class MemoryCard {
  private readonly _photos = inject(WorkoutPhotoStore);
  private readonly _destroyRef = inject(DestroyRef);

  readonly memory = input.required<WorkoutMemory>();
  readonly open = output<void>();

  readonly photoUrl = signal<string | null>(null);

  readonly when = computed(() => memoryWhen(this.memory().monthsAgo));

  readonly values = computed(() => {
    const { exercise } = this.memory();
    return {
      exercise: exercise.name,
      from: formatMeasure(exercise.fromKg),
      to: formatMeasure(exercise.toKg),
    };
  });

  constructor() {
    effect(() => {
      const { workout } = this.memory();
      this.photoUrl.set(null);
      if (!workout.hasPhoto) return;
      // Quiet on failure: the card stands on navy without its picture.
      this._photos
        .url(workout.id, workout.photoVersion)
        .pipe(take(1), takeUntilDestroyed(this._destroyRef))
        .subscribe({ next: (url) => this.photoUrl.set(url), error: () => undefined });
    });
  }
}
