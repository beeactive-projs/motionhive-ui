import { Routes } from '@angular/router';

/**
 * The coach's authoring area, mounted at `/tabs/programs`.
 *
 * Routines open the round-1 builder — the same screen the trainee authors in,
 * because a routine is a routine whoever wrote it. Programs get the week grid,
 * and a day inside one opens that same builder again with a week·day context.
 */
export const programRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./programs').then((m) => m.Programs),
    title: 'Programs - MotionHive',
  },
  {
    path: 'routine/:id',
    loadComponent: () =>
      import('../workouts/routine-builder/routine-builder').then((m) => m.RoutineBuilder),
    title: 'Routine - MotionHive',
  },
  {
    path: 'program/:id',
    loadComponent: () =>
      import('./program-builder/program-builder').then((m) => m.ProgramBuilder),
    title: 'Program - MotionHive',
  },
  {
    path: 'program/:id/settings',
    loadComponent: () =>
      import('./program-settings/program-settings').then((m) => m.ProgramSettings),
    title: 'Program settings - MotionHive',
  },
  {
    path: 'program/:id/day/:workoutId',
    loadComponent: () => import('./day-editor/day-editor').then((m) => m.DayEditor),
    title: 'Day - MotionHive',
  },
  {
    path: 'program/:id/assignments',
    loadComponent: () =>
      import('./assignments/assignments').then((m) => m.Assignments),
    title: 'Assignments - MotionHive',
  },
];
