import { Routes } from '@angular/router';

import { coachGuard } from '../../_shared/guards/coach.guard';

/**
 * The exercise library, mounted at `/tabs/exercises`.
 *
 * Browsing is open to both roles — the catalogue is reference material, and
 * the API serves `GET /exercises` to trainees as well. `new` and `edit` are
 * the coach's full form and carry the guard. Anyone else makes and edits
 * their own (private) exercises in the short form's sheet, which opens in
 * place from the library, the picker and the exercise's page, so it needs
 * no route.
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
