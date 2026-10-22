import { Routes } from '@angular/router';

/**
 * The coach's authoring area, mounted at `/tabs/programs`.
 *
 * Routines open the round-1 builder — the same screen the trainee authors in,
 * because a routine is a routine whoever wrote it. Programs get the week grid,
 * and a day inside one opens that same builder again with a week·day context.
 *
 * Who needs attention is not here: that is the Clients tab's triage lens, and
 * a second roster under programs was the same list with a different colour
 * map. A client's own training and a logged workout mount under clients for
 * the same reason — they are reached from the person.
 */
export const programRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./programs').then((m) => m.Programs),
    title: 'pageTitle.programs',
  },
  {
    path: 'routine/:id',
    loadComponent: () =>
      import('../workouts/routine-builder/routine-builder').then((m) => m.RoutineBuilder),
    title: 'pageTitle.routine',
  },
  {
    // The catalog page, pushed onto THIS stack so back returns to the routine
    // or day it was opened from. On the Workouts stack, back had nothing of
    // the coach's to pop and fell through to the exercise list.
    path: 'exercise/:exerciseId',
    loadComponent: () =>
      import('../exercises/exercise-detail/exercise-detail').then((m) => m.ExerciseDetail),
    title: 'pageTitle.exercise',
  },
  // A client, opened from a plan's list of who is on it — the same screens
  // the Clients tab mounts, pushed onto THIS stack so back returns to the
  // plan. See `clients/client-paths.ts`.
  {
    path: 'client/:clientId/training',
    loadComponent: () =>
      import('./client-training/client-training').then((m) => m.ClientTraining),
    title: 'pageTitle.training',
  },
  {
    path: 'client/:clientId/progress/:exerciseId',
    loadComponent: () =>
      import('../workouts/exercise-progress/exercise-progress').then((m) => m.ExerciseProgress),
    title: 'pageTitle.exerciseProgress',
  },
  {
    path: 'client/:clientId/progress',
    loadComponent: () => import('../workouts/progress/progress').then((m) => m.Progress),
    title: 'pageTitle.progress',
  },
  {
    path: 'client/:clientId',
    loadComponent: () =>
      import('../clients/client-detail/client-detail').then((m) => m.ClientDetail),
    title: 'pageTitle.client',
  },
  {
    path: 'log/:id',
    loadComponent: () => import('./log-review/log-review').then((m) => m.LogReview),
    title: 'pageTitle.workout',
  },
  {
    path: 'person/:handle',
    loadComponent: () => import('../person/person').then((m) => m.Person),
    title: 'pageTitle.profile',
  },
  {
    path: 'program/:id',
    loadComponent: () =>
      import('./program-builder/program-builder').then((m) => m.ProgramBuilder),
    title: 'pageTitle.program',
  },
  {
    // The settings page became the builder's ⋯ sheet; an old link lands there.
    path: 'program/:id/settings',
    redirectTo: 'program/:id',
  },
  {
    path: 'program/:id/day/:workoutId',
    loadComponent: () => import('./day-editor/day-editor').then((m) => m.DayEditor),
    title: 'pageTitle.day',
  },
  {
    path: 'program/:id/assignments',
    loadComponent: () =>
      import('./assignments/assignments').then((m) => m.Assignments),
    title: 'pageTitle.assignments',
  },
];
