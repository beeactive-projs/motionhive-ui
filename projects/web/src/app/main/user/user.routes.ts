import { Routes } from '@angular/router';

export const userRoutes: Routes = [
  {
    path: 'sessions',
    loadComponent: () => import('./my-sessions/my-sessions').then((m) => m.MySessions),
    title: 'pageTitle.mySessions',
  },
  {
    path: 'workouts',
    redirectTo: 'training',
    pathMatch: 'full',
  },
  {
    path: 'routines/:id',
    loadComponent: () =>
      import('./my-workouts/routine-detail/routine-detail').then(
        (m) => m.RoutineDetail,
      ),
    title: 'pageTitle.routine',
  },
  {
    path: 'training',
    loadComponent: () => import('./training/training').then((m) => m.Training),
    title: 'pageTitle.workouts',
  },
  {
    path: 'progress',
    // History folded into the Overview lens, which is the default, so a
    // bare redirect lands in the right place without a query param.
    redirectTo: 'training',
    pathMatch: 'full',
  },
  {
    path: 'progress/exercises/:exerciseId',
    loadComponent: () =>
      import('./progress/exercise-progress/exercise-progress').then(
        (m) => m.ExerciseProgressPage,
      ),
    title: 'pageTitle.exerciseProgress',
  },
  {
    path: 'plans',
    // Plans has its own top-level route again. It used to redirect to
    // Training?view=plans, but with no discoverable "Plans" nav entry
    // the assignment was reachable only by clicking a notification.
    // MyPlans is the exact list the Training-page lens renders inline,
    // so this is one component in two mount points, not two copies.
    loadComponent: () =>
      import('./my-plans/my-plans').then((m) => m.MyPlans),
    title: 'pageTitle.myPlans',
  },
  {
    path: 'plans/:id',
    loadComponent: () =>
      import('./my-plans/client-plan-detail/client-plan-detail').then(
        (m) => m.ClientPlanDetail,
      ),
    title: 'pageTitle.myPlan',
  },
  {
    // Active workout logger (live session).
    path: 'workout-log/:id',
    loadComponent: () =>
      import('./my-workouts/workout-log-active/workout-log-active').then(
        (m) => m.WorkoutLogActive,
      ),
    title: 'pageTitle.workout',
  },
  {
    // Read-only workout replay — used by client history + coach (with ?coach=1).
    path: 'workout-log/:id/replay',
    loadComponent: () =>
      import('./my-workouts/workout-log-replay/workout-log-replay').then(
        (m) => m.WorkoutLogReplay,
      ),
    title: 'pageTitle.workoutReplay',
  },
  {
    // Post-workout summary + feedback.
    path: 'workouts/:id/complete',
    loadComponent: () =>
      import('./my-workouts/workout-complete/workout-complete').then(
        (m) => m.WorkoutComplete,
      ),
    title: 'pageTitle.workoutComplete',
  },
  {
    path: 'sessions/discover',
    loadComponent: () =>
      import('./my-sessions/sessions-discover/sessions-discover').then(
        (m) => m.SessionsDiscover,
      ),
    title: 'pageTitle.discoverSessions',
  },
  {
    // Day-of online countdown. Declared before `sessions/:id` so the
    // `/join` suffix wins; `sessions/discover` above already wins over `:id`.
    path: 'sessions/:id/join',
    loadComponent: () =>
      import('../session-day-of-online/session-day-of-online').then(
        (m) => m.SessionDayOfOnline,
      ),
    title: 'pageTitle.joinSession',
  },
  {
    // Public session showcase (reached from Discover, share links, reminders).
    path: 'sessions/:id',
    loadComponent: () =>
      import('./my-sessions/session-showcase/session-showcase').then(
        (m) => m.SessionShowcase,
      ),
    title: 'pageTitle.session',
  },
];
