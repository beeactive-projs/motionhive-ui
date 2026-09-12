import { Routes } from '@angular/router';

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
    title: 'Workouts - MotionHive',
  },
  {
    // Before `:id` routes, or the parameterised paths swallow the words.
    path: 'starters',
    loadComponent: () => import('./starters/starters').then((m) => m.Starters),
    title: 'Starter routines - MotionHive',
  },
  {
    path: 'history',
    loadComponent: () => import('./history/history').then((m) => m.History),
    title: 'History - MotionHive',
  },
  {
    path: 'progress',
    loadComponent: () => import('./progress/progress').then((m) => m.Progress),
    title: 'Progress - MotionHive',
  },
  {
    // The catalog page, pushed onto THIS stack rather than the exercises tab:
    // checking what a movement is must not tear down the routine you are
    // building or the workout you are logging.
    path: 'exercise/:exerciseId',
    loadComponent: () =>
      import('../exercises/exercise-detail/exercise-detail').then((m) => m.ExerciseDetail),
    title: 'Exercise - MotionHive',
  },
  {
    path: 'routine/:id',
    loadComponent: () =>
      import('./routine-builder/routine-builder').then((m) => m.RoutineBuilder),
    title: 'Routine - MotionHive',
  },
  {
    path: 'preview/:assignmentId',
    loadComponent: () => import('./preview/preview').then((m) => m.Preview),
    title: 'Workout - MotionHive',
  },
  {
    path: 'log/:id',
    loadComponent: () => import('./logger/logger').then((m) => m.Logger),
    title: 'Workout - MotionHive',
  },
  {
    path: 'finish/:id',
    loadComponent: () => import('./finish/finish').then((m) => m.Finish),
    title: 'Workout complete - MotionHive',
  },
];
