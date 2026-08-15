import { Routes } from '@angular/router';

/**
 * The messages area, mounted at `/tabs/messages`.
 *
 * Every path keeps `messages` as the first segment after `/tabs` — that is what
 * `activeTabIdFromUrl` reads, so the Messages tab stays lit through the chat
 * and its details page instead of the bar going blank.
 *
 * `new` is a draft thread: the chat screen with no conversation behind it yet,
 * addressed by a `?to=` recipient. It has to be declared before `:id` or the
 * parameterised route would swallow it and try to load a conversation called
 * "new". Once the first message sends, the store swaps the URL for the real
 * conversation id.
 */
export const messagesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./messages').then((m) => m.Messages),
    title: 'Messages - MotionHive',
  },
  {
    // The composer owns the bottom edge — the keyboard opens straight onto it,
    // and a tab bar wedged between the two costs a message of visible thread.
    path: 'new',
    loadComponent: () => import('./chat/chat').then((m) => m.Chat),
    title: 'New message - MotionHive',
    data: { hideTabBar: true },
  },
  {
    path: ':id',
    loadComponent: () => import('./chat/chat').then((m) => m.Chat),
    title: 'Chat - MotionHive',
    data: { hideTabBar: true },
  },
  {
    path: ':id/details',
    loadComponent: () => import('./chat-details/chat-details').then((m) => m.ChatDetails),
    title: 'Details - MotionHive',
  },
];
