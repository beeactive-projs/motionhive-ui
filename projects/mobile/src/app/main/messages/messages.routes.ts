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
  {
    // Message requests and archived chats: one screen over a folder of the
    // inbox, named by `data.folder`. Before the chat pages, whose `:id`
    // would take the words.
    path: 'requests',
    loadComponent: () => import('./folder/folder').then((m) => m.ConversationFolderPage),
    title: 'pageTitle.messageRequests',
    data: { folder: 'requests' },
  },
  {
    path: 'archived',
    loadComponent: () => import('./folder/folder').then((m) => m.ConversationFolderPage),
    title: 'pageTitle.archivedChats',
    data: { folder: 'archived' },
  },
  ...personRoutes,
  ...chatPageRoutes,
];
