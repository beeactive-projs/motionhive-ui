import { inject } from '@angular/core';
import { Router } from '@angular/router';

import { MessagingStore } from 'core';

import { ProfileStacks, chatBase, stackRootOf } from './stack-paths';

/** Anything carrying the identity a DM needs. */
export interface MessageablePerson {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Open the conversation with someone, from anywhere in the app.
 *
 * Reopens the existing thread when there is one, so you land on the history
 * rather than a blank draft. Otherwise it routes to the draft chat, where the
 * BE creates the conversation on the first send — an abandoned draft leaves
 * nothing behind.
 *
 * In the stack it was asked from, when that stack mounts a chat (every one
 * with a profile does): back then returns to the screen that asked, not to
 * the Messages list. From anywhere else it opens the Messages tab's own.
 *
 * Call from an injection context.
 */
export function injectOpenDirectMessage(): (person: MessageablePerson) => void {
  const store = inject(MessagingStore);
  const router = inject(Router);

  return (person) => {
    const base = chatBase(stackRootOf(router.url));
    const existing = store.findDirectWith(person.id);
    if (existing) {
      if (base === ProfileStacks.Messages) store.openConversation(existing.id);
      // The chat loads the thread from its URL, as on a deep link.
      else void router.navigate([base, existing.id]);
      return;
    }

    const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
    void router.navigate([base, 'new'], {
      queryParams: { to: person.id, ...(name ? { name } : {}) },
    });
  };
}
