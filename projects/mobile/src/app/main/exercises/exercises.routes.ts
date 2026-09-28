import { Routes } from '@angular/router';

import { coachGuard } from '../../_shared/guards/coach.guard';

/**
 * The exercise library, mounted at `/tabs/exercises`.
 *
 * Browsing is open to both roles — the catalogue is reference material, and
 * the API serves `GET /exercises` to trainees as well. Authoring is not: the
 * write endpoints are instructor-only, so `new` and `edit` carry the guard
 * rather than letting a deep link open a form whose Save can only 403.
 *
 * Every path keeps `exercises` as the first segment after `/tabs` so the
 * menu tab stays lit on the pushed screens — same rule as clients and
 * sessions.
 */
export const exercisesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./exercises').then((m) => m.Exercises),
    title: 'pageTitle.exercises',
  },
  {
    // Before `:exerciseId`, or the parameterised route swallows the word.
    path: 'new',
    canActivate: [coachGuard],
    loadComponent: () => import('./exercise-create/exercise-create').then((m) => m.ExerciseCreate),
    title: 'pageTitle.newExercise',
  },
  {
    path: ':exerciseId',
    loadComponent: () => import('./exercise-detail/exercise-detail').then((m) => m.ExerciseDetail),
    title: 'pageTitle.exercise',
  },
  {
    path: ':exerciseId/edit',
    canActivate: [coachGuard],
    loadComponent: () => import('./exercise-edit/exercise-edit').then((m) => m.ExerciseEdit),
    title: 'pageTitle.editExercise',
  },
];
