import { inject } from '@angular/core';
import { Router } from '@angular/router';

import { MessagingStore } from 'core';

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
 * Call from an injection context.
 */
export function injectOpenDirectMessage(): (person: MessageablePerson) => void {
  const store = inject(MessagingStore);
  const router = inject(Router);

  return (person) => {
    const existing = store.findDirectWith(person.id);
    if (existing) {
      store.openConversation(existing.id);
      return;
    }

    const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
    void router.navigate(['/tabs/messages/new'], {
      queryParams: { to: person.id, ...(name ? { name } : {}) },
    });
  };
}
