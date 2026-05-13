import { Routes } from '@angular/router';

/**
 * Messaging feature routes — lazily loaded from main.routes under
 * `/messages`. See docs/plans/messaging-frontend-plan.md §4.
 *
 * Compose mode ("New message" picker) is NOT a route — it's a flag
 * on MessagingStore. See plan §14 decision #3.
 */
export const messagesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/inbox/inbox-page').then((m) => m.InboxPage),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/empty-state/empty-state').then((m) => m.EmptyState),
        title: 'Messages - MotionHive',
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./components/conversation-pane/conversation-pane').then(
            (m) => m.ConversationPane,
          ),
        title: 'Conversation - MotionHive',
      },
    ],
  },
];
