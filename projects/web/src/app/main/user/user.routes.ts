import { inject } from '@angular/core';
import { Router, Routes, UrlTree } from '@angular/router';

export const userRoutes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
    title: 'Dashboard - MotionHive',
  },
  {
    // Legacy path. Coaches now live in the profile "Coaches" tab.
    path: 'instructors',
    canActivate: [
      (): UrlTree =>
        inject(Router).createUrlTree(['/profile'], { queryParams: { tab: 'coaches' } }),
    ],
    children: [],
  },
  {
    path: 'sessions',
    loadComponent: () => import('./my-sessions/my-sessions').then((m) => m.MySessions),
    title: 'My sessions - MotionHive',
  },
  {
    path: 'workouts',
    loadComponent: () => import('./my-workouts/my-workouts').then((m) => m.MyWorkouts),
    title: 'Workout history - MotionHive',
  },
  {
    path: 'plans',
    loadComponent: () => import('./my-plans/my-plans').then((m) => m.MyPlans),
    title: 'My plans - MotionHive',
  },
  {
    path: 'plans/:id',
    loadComponent: () =>
      import('./my-plans/client-plan-detail/client-plan-detail').then(
        (m) => m.ClientPlanDetail,
      ),
    title: 'My plan - MotionHive',
  },
  {
    // Active workout logger (live session).
    path: 'workout-log/:id',
    loadComponent: () =>
      import('./my-workouts/workout-log-active/workout-log-active').then(
        (m) => m.WorkoutLogActive,
      ),
    title: 'Workout - MotionHive',
  },
  {
    // Read-only workout replay — used by client history + coach (with ?coach=1).
    path: 'workout-log/:id/replay',
    loadComponent: () =>
      import('./my-workouts/workout-log-replay/workout-log-replay').then(
        (m) => m.WorkoutLogReplay,
      ),
    title: 'Workout replay - MotionHive',
  },
  {
    // Post-workout summary + feedback.
    path: 'workouts/:id/complete',
    loadComponent: () =>
      import('./my-workouts/workout-complete/workout-complete').then(
        (m) => m.WorkoutComplete,
      ),
    title: 'Workout complete - MotionHive',
  },
  {
    path: 'sessions/discover',
    loadComponent: () =>
      import('./my-sessions/sessions-discover/sessions-discover').then(
        (m) => m.SessionsDiscover,
      ),
    title: 'Discover sessions - MotionHive',
  },
  {
    // Day-of online countdown. Declared before `sessions/:id` so the
    // `/join` suffix wins; `sessions/discover` above already wins over `:id`.
    path: 'sessions/:id/join',
    loadComponent: () =>
      import('../session-day-of-online/session-day-of-online').then(
        (m) => m.SessionDayOfOnline,
      ),
    title: 'Join session - MotionHive',
  },
  {
    // Public session showcase (reached from Discover, share links, reminders).
    path: 'sessions/:id',
    loadComponent: () =>
      import('./my-sessions/session-showcase/session-showcase').then(
        (m) => m.SessionShowcase,
      ),
    title: 'Session - MotionHive',
  },
];
