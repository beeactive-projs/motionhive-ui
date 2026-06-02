import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import type { Equipment } from '../models/exercise/equipment.model';
import type { Muscle } from '../models/exercise/muscle.model';
import { ExerciseService } from '../services/exercise/exercise.service';

/**
 * Caches the muscle + equipment taxonomy after the first load. Both
 * lists are tiny (~17 + ~15 rows) and effectively static between
 * deploys; reloading them on every component mount would be wasteful.
 *
 * Components call `ensureLoaded()` in their constructor / `ngOnInit`
 * (the call is idempotent + race-safe — concurrent callers all share
 * the in-flight request via the loading guard).
 *
 * Filter panels and the muscle picker read derived computeds
 * (`muscleById`, `equipmentById`) to translate the BE's UUID-keyed
 * facet maps into display rows without an extra `find()` in the
 * template.
 */
@Injectable({ providedIn: 'root' })
export class ExerciseTaxonomyStore {
  private readonly _muscles = signal<Muscle[]>([]);
  private readonly _equipment = signal<Equipment[]>([]);
  private readonly _loaded = signal(false);
  private readonly _loading = signal(false);

  private readonly _exerciseService = inject(ExerciseService);

  readonly muscles = this._muscles.asReadonly();
  readonly equipment = this._equipment.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly loading = this._loading.asReadonly();

  /** O(1) lookups for facet-count → label rendering. */
  readonly muscleById = computed<Map<string, Muscle>>(
    () => new Map(this._muscles().map((m) => [m.id, m])),
  );
  readonly equipmentById = computed<Map<string, Equipment>>(
    () => new Map(this._equipment().map((e) => [e.id, e])),
  );

  /** First-call wins. Re-callers (including concurrent ones) no-op. */
  ensureLoaded(): void {
    if (this._loaded() || this._loading()) return;
    this._loading.set(true);
    forkJoin({
      muscles: this._exerciseService.listMuscles(),
      equipment: this._exerciseService.listEquipment(),
    }).subscribe({
      next: ({ muscles, equipment }) => {
        this._muscles.set(muscles);
        this._equipment.set(equipment);
        this._loaded.set(true);
      },
      error: () => {
        // Failure leaves the lists empty; downstream filters will be
        // empty rather than wrong. Components can call `reload()` on retry.
      },
      complete: () => this._loading.set(false),
    });
  }

  /** Force a refresh (rare — taxonomy doesn't change between deploys). */
  reload(): void {
    this._loaded.set(false);
    this.ensureLoaded();
  }
}
