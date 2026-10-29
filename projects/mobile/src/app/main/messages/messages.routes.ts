import { Routes } from '@angular/router';
import { personRoutes } from '../person/person.routes';
import { chatPageRoutes } from './chat-pages.routes';

/**
 * The messages area, mounted at `/tabs/messages`.
 *
 * Every path keeps `messages` as the first segment after `/tabs` — that is what
 * `activeTabIdFromUrl` reads, so the Messages tab stays lit through the chat
 * and its details page instead of the bar going blank. The chat pages
 * themselves (`chat-pages.routes.ts`) go last: their `:id` would swallow
 * "compose" and "person".
 */
export const messagesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./messages').then((m) => m.Messages),
    title: 'pageTitle.messages',
  },
  {
    // Who to write to. Picking replaces it with the thread or the draft below.
    path: 'compose',
    loadComponent: () => import('./new-message/new-message').then((m) => m.NewMessage),
    title: 'pageTitle.newMessage',
  },
  ...personRoutes,
  ...chatPageRoutes,
];
