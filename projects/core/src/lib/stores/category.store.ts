import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { CategoryKinds } from '../models/onboarding/onboarding.enums';
import type { Category } from '../models/onboarding/onboarding.model';
import { CategoryService } from '../services/onboarding/category.service';

/**
 * MotionHive's category list, loaded once and kept: twenty rows that change
 * only with a deploy. Like `ExerciseTaxonomyStore`, callers run
 * `ensureLoaded()` and read the signals; a failure leaves the list empty,
 * says so in `failed`, and the next `ensureLoaded()` tries again.
 *
 * Names arrive in the reader's language. A language switch reloads the
 * whole app, so the list is never asked for twice in one language.
 */
@Injectable({ providedIn: 'root' })
export class CategoryStore {
  private readonly _categoryService = inject(CategoryService);

  private readonly _categories = signal<Category[]>([]);
  private readonly _loaded = signal(false);
  private readonly _loading = signal(false);
  private readonly _failed = signal(false);

  readonly categories = this._categories.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly loading = this._loading.asReadonly();
  /** The last load failed: a screen that needs the list offers a retry. */
  readonly failed = this._failed.asReadonly();

  /** What people train, in the list's order. */
  readonly activities = computed(() =>
    this._categories().filter((category) => category.kind === CategoryKinds.Activity),
  );

  /** What a person may pick as an interest: activities, none of the coaches only ones. */
  readonly interestActivities = computed(() =>
    this.activities().filter((category) => !category.coachesOnly),
  );

  /** Why people train. */
  readonly goals = computed(() =>
    this._categories().filter((category) => category.kind === CategoryKinds.Goal),
  );

  readonly byId = computed(
    () => new Map(this._categories().map((category) => [category.id, category])),
  );

  ensureLoaded(): void {
    if (this._loaded() || this._loading()) {
      return;
    }
    this._loading.set(true);
    this._failed.set(false);
    this._categoryService
      .list()
      .pipe(take(1))
      .subscribe({
        next: (categories) => {
          this._categories.set(categories);
          this._loaded.set(true);
          this._loading.set(false);
        },
        error: () => {
          this._loading.set(false);
          this._failed.set(true);
        },
      });
  }

  /** Ask the API again: the retry on a screen whose load failed. */
  reload(): void {
    this._loaded.set(false);
    this.ensureLoaded();
  }
}

/** The names of `ids` in the list's order (activities first), skipping unknown ones. */
export function categoryNames(
  ids: readonly string[] | null | undefined,
  byId: ReadonlyMap<string, Category>,
): string[] {
  const picked: Category[] = [];
  for (const id of ids ?? []) {
    const category = byId.get(id);
    if (category) {
      picked.push(category);
    }
  }
  picked.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === CategoryKinds.Activity ? -1 : 1;
    }
    return a.displayOrder - b.displayOrder;
  });
  return picked.map((category) => category.name);
}

/** The two fields of a coach row that say what they coach. */
interface CoachSpecialtyFields {
  specializations: readonly string[] | null;
  categoryIds?: readonly string[];
}

/**
 * A coach row whose `specializations` say what they coach: their own words
 * when they wrote some, else the names of their categories. A coach who set
 * up through the welcome flow picked categories and may have written none,
 * and every line under a coach's name reads `specializations`.
 */
export function withCategorySpecialties<T extends CoachSpecialtyFields>(
  coach: T,
  byId: ReadonlyMap<string, Category>,
): T {
  const own = coach.specializations ?? [];
  if (own.length > 0) {
    return coach;
  }
  const names = categoryNames(coach.categoryIds, byId);
  if (names.length === 0) {
    return coach;
  }
  return { ...coach, specializations: names };
}
