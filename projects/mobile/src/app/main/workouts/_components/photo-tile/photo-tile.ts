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

import { WorkoutLog, appLocale } from 'core';

import { WorkoutPhotoStore } from '../../_services/workout-photo';

/**
 * One workout in History's photo grid: its photo as a 3:4 crop (fetched
 * small, through the API) and the day it was done.
 */
@Component({
  selector: 'mh-photo-tile',
  imports: [TranslatePipe],
  templateUrl: './photo-tile.html',
  styleUrl: './photo-tile.scss',
})
export class PhotoTile {
  private readonly _photos = inject(WorkoutPhotoStore);
  private readonly _destroyRef = inject(DestroyRef);

  readonly log = input.required<WorkoutLog>();
  readonly select = output<void>();

  readonly url = signal<string | null>(null);

  /** "22 Oct". */
  readonly day = computed(() =>
    new Date(this.log().completedAt ?? this.log().startedAt).toLocaleDateString(appLocale(), {
      day: 'numeric',
      month: 'short',
    }),
  );

  constructor() {
    effect(() => {
      const log = this.log();
      // Quiet on failure: the tile keeps its plain surface and its date.
      this._photos
        .thumbUrl(log.id, log.photoVersion ?? null)
        .pipe(take(1), takeUntilDestroyed(this._destroyRef))
        .subscribe({ next: (url) => this.url.set(url), error: () => undefined });
    });
  }
}
