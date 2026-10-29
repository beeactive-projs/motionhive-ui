import { Routes } from '@angular/router';

/**
 * A plan and what it opens: the week grid, a day, who is on it, and the
 * catalog page of an exercise in it. Mounted at the root of both coach
 * stacks, Programs and Clients, because a plan is opened from a client's
 * page in either: back returns to the client, not to the Programs list.
 * Each page builds its links with `coachStackOf` from the stack it is in.
 */
export const programPageRoutes: Routes = [
  {
    // The catalog page, pushed onto the same stack so back returns to the
    // routine or day it was opened from. On the Workouts stack, back had
    // nothing of the coach's to pop and fell through to the exercise list.
    path: 'exercise/:exerciseId',
    loadComponent: () =>
      import('../exercises/exercise-detail/exercise-detail').then((m) => m.ExerciseDetail),
    title: 'pageTitle.exercise',
  },
  {
    path: 'program/:id',
    loadComponent: () => import('./program-builder/program-builder').then((m) => m.ProgramBuilder),
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
    loadComponent: () => import('./assignments/assignments').then((m) => m.Assignments),
    title: 'pageTitle.assignments',
  },
];
