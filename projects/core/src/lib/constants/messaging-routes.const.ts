import { InjectionToken } from '@angular/core';

/**
 * Where messaging is mounted in the host app.
 *
 * `MessagingStore` navigates on its own — opening a thread, leaving one after a
 * block, swapping an optimistic id for the real one — and web's `/messages` is
 * not mobile's `/tabs/messages`. Web is the default so it needs no provider.
 */
export const MESSAGING_ROUTES = new InjectionToken<readonly string[]>(
  'MESSAGING_ROUTES',
  {
    providedIn: 'root',
    factory: () => ['/messages'],
  },
);
