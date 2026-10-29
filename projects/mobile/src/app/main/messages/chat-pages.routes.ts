import { Routes } from '@angular/router';

/**
 * One conversation and its details. The Messages tab mounts these at its
 * root (`/tabs/messages/:id`); every stack that mounts a profile mounts them
 * under `chat/` too, so a Message tapped on a profile opens in that stack
 * and back returns to the profile (`stack-paths.ts`).
 *
 * `new` is a draft thread: the chat screen with no conversation behind it yet,
 * addressed by a `?to=` recipient. It has to be declared before `:id` or the
 * parameterised route would swallow it and try to load a conversation called
 * "new". Once the first message sends, the draft adopts the new conversation
 * on the same screen; the URL keeps `new?to=`, which resolves to the thread.
 */
export const chatPageRoutes: Routes = [
  {
    // The composer owns the bottom edge — the keyboard opens straight onto it,
    // and a tab bar wedged between the two costs a message of visible thread.
    path: 'new',
    loadComponent: () => import('./chat/chat').then((m) => m.Chat),
    title: 'pageTitle.newMessage',
    data: { hideTabBar: true },
  },
  {
    path: ':id',
    loadComponent: () => import('./chat/chat').then((m) => m.Chat),
    title: 'pageTitle.chat',
    data: { hideTabBar: true },
  },
  {
    path: ':id/details',
    loadComponent: () => import('./chat-details/chat-details').then((m) => m.ChatDetails),
    title: 'pageTitle.details',
  },
];
