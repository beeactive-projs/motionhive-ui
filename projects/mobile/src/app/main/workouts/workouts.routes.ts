import { Routes } from '@angular/router';

import { WorkoutTabs, workoutTabRedirect } from './workouts.config';

/**
 * The trainee's training area, mounted at `/tabs/workouts`.
 *
 * Every path keeps `workouts` as the first segment after `/tabs` so the tab
 * stays lit on pushed screens — the same rule the sessions and discover
 * areas follow.
 *
 * The logger takes `new` for a freestyle session and an id to resume one, so
 * "start empty" and "pick up where I left off" are the same screen rather
 * than two that must agree with each other.
 */
export const workoutRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./workouts').then((m) => m.Workouts),
    title: 'pageTitle.workouts',
  },
  {
    // Before `:id` routes, or the parameterised paths swallow the words.
    path: 'starters',
    loadComponent: () => import('./starters/starters').then((m) => m.Starters),
    title: 'pageTitle.starterRoutines',
  },
  // History, Progress and the exercise library are tabs of the Workouts
  // page now; their old addresses open it on that tab. `full`: a redirect
  // matches by prefix otherwise, and `progress` swallowed every
  // `progress/:exerciseId`, so a record opened nothing.
  { path: 'history', pathMatch: 'full', redirectTo: workoutTabRedirect(WorkoutTabs.History) },
  { path: 'progress', pathMatch: 'full', redirectTo: workoutTabRedirect(WorkoutTabs.Progress) },
  {
    // One exercise's progress, opened from a record on the Progress tab. A
    // sibling rather than a child route, so the tab stays lit and back
    // returns to Progress.
    path: 'progress/:exerciseId',
    loadComponent: () =>
      import('./exercise-progress/exercise-progress').then((m) => m.ExerciseProgress),
    title: 'pageTitle.exerciseProgress',
  },
  { path: 'exercises', pathMatch: 'full', redirectTo: workoutTabRedirect(WorkoutTabs.Exercises) },
  {
    // The catalog page, pushed onto THIS stack rather than the exercises tab:
    // checking what a movement is must not tear down the routine you are
    // building or the workout you are logging.
    path: 'exercise/:exerciseId',
    loadComponent: () =>
      import('../exercises/exercise-detail/exercise-detail').then((m) => m.ExerciseDetail),
    title: 'pageTitle.exercise',
  },
  {
    path: 'routine/:id',
    loadComponent: () =>
      import('./routine-builder/routine-builder').then((m) => m.RoutineBuilder),
    title: 'pageTitle.routine',
  },
  {
    // The trainee's view of a multi-week plan.
    path: 'plan/:id',
    loadComponent: () => import('./plan/plan').then((m) => m.Plan),
    title: 'pageTitle.plan',
  },
  {
    path: 'preview/:assignmentId',
    loadComponent: () => import('./preview/preview').then((m) => m.Preview),
    title: 'pageTitle.workout',
  },
  {
    path: 'log/:id',
    loadComponent: () => import('./logger/logger').then((m) => m.Logger),
    title: 'pageTitle.workout',
  },
  {
    path: 'finish/:id',
    loadComponent: () => import('./finish/finish').then((m) => m.Finish),
    title: 'pageTitle.workoutComplete',
  },
];
