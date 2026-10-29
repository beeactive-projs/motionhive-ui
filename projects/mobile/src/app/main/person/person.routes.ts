import { Routes } from '@angular/router';

import { groupPageRoutes } from '../groups/group-pages.routes';
import { chatPageRoutes } from '../messages/chat-pages.routes';

/**
 * A person's profile, one workout on it, and what it opens (the chat with
 * them, a group you share), mounted in every stack that names people so the
 * tab you came from stays lit and back returns where you were. Spread before
 * a stack's parameterised routes, or they swallow the words "person",
 * "chat" and "groups". Links into them: `stack-paths.ts`.
 */
export const personRoutes: Routes = [
  {
    path: 'person/:handle',
    loadComponent: () => import('./person').then((m) => m.Person),
    title: 'pageTitle.profile',
  },
  {
    path: 'person/:handle/workout/:workoutLogId',
    loadComponent: () =>
      import('./profile-workout/profile-workout').then((m) => m.ProfileWorkoutPage),
    title: 'pageTitle.workout',
  },
  { path: 'chat', children: chatPageRoutes },
  { path: 'groups', children: groupPageRoutes },
];
