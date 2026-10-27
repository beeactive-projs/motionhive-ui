import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonList,
  IonNote,
  IonSearchbar,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { catchError, of, take } from 'rxjs';

import {
  ClientService,
  ConversationListItem,
  MessagingStore,
  MyInstructor,
  ProfileService,
  SuggestedCoach,
  conversationMatches,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { RecentPerson, SUGGESTION_LIMIT } from '../../../_shared/config/recent-searches.config';
import { SearchbarAutofocusDirective } from '../../../_shared/directives/searchbar-autofocus.directive';
import { injectPeopleSearch } from '../../../_shared/utils/people-search';
import { ConversationRow } from '../_components/conversation-row/conversation-row';
import { PersonRow } from '../../../_shared/components/person-row/person-row';
import { RowSkeleton } from '../../../_shared/components/row-skeleton/row-skeleton';
import {
  MESSAGING_ICONS,
  frequentContacts,
  recentFromPerson,
  suggestedContacts,
} from '../messages.config';

/**
 * "New message": who to write to, after Messenger's page of the same name.
 *
 * Before anything is typed it lists Suggested (the reader's own coaches, then
 * the coaches `GET /profile/instructors/suggested` picks) and the frequent
 * contacts after them. No recents: those belong to the inbox search, which is
 * for finding something, not someone to start with. Typing lists people from
 * `/users/search` and the conversations that match.
 *
 * Picking creates nothing. It replaces this page with the thread, or with a
 * draft (`new?to=`) when there is none, so back from the chat lands on the
 * inbox. The conversation filter is local, not the store's search query,
 * which belongs to the inbox.
 */
@Component({
  selector: 'mh-new-message',
  imports: [
    ConversationRow,
    EmptyState,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonList,
    IonNote,
    IonSearchbar,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    PersonRow,
    RowSkeleton,
    SearchbarAutofocusDirective,
    TranslatePipe,
  ],
  templateUrl: './new-message.html',
  styleUrl: './new-message.scss',
})
export class NewMessage implements ViewWillEnter {
  readonly store = inject(MessagingStore);
  private readonly _clientService = inject(ClientService);
  private readonly _profileService = inject(ProfileService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  readonly people = injectPeopleSearch();

  private readonly _myCoaches = signal<MyInstructor[]>([]);
  private readonly _suggestedCoaches = signal<SuggestedCoach[]>([]);
  private readonly _myCoachesLoading = signal(true);
  private readonly _suggestedLoading = signal(true);

  readonly suggested = computed(() =>
    suggestedContacts(this._myCoaches(), this._suggestedCoaches()),
  );

  /** Whoever is already under Suggested is not listed again. */
  readonly frequent = computed(() =>
    frequentContacts(this.store.conversations(), this.suggested().map((person) => person.id)),
  );

  readonly results = computed(() => this.people.results().map(recentFromPerson));

  readonly conversations = computed(() => {
    const query = this.people.query().trim().toLowerCase();
    return this.store.conversations().filter((conversation) =>
      conversationMatches(conversation, query),
    );
  });

  readonly startSkeletonRows = [1, 2, 3, 4, 5];
  readonly searchSkeletonRows = [1, 2, 3];

  /**
   * Both coach lists, and the inbox on a cold start, which Frequent comes
   * from. Rows wait for all three, so Suggested never lands above a list
   * that is already being read.
   */
  readonly isStartLoading = computed(
    () =>
      this._myCoachesLoading() ||
      this._suggestedLoading() ||
      (this.store.loading() && !this.store.hasLoaded()),
  );

  /** Everything has loaded and there is nobody to suggest: a hint instead. */
  readonly isStartEmpty = computed(
    () =>
      !this.isStartLoading() && this.suggested().length === 0 && this.frequent().length === 0,
  );

  /** The first answer to a search is on its way and there is nothing yet to show. */
  readonly showPeopleSkeleton = computed(
    () => this.people.isSearching() && this.people.results().length === 0,
  );

  readonly isSearchEmpty = computed(
    () => this.people.isEmpty() && this.conversations().length === 0,
  );

  constructor() {
    addIcons(MESSAGING_ICONS);
    this._loadCoaches();
  }

  // The frequent contacts come from the inbox, which may not have loaded yet
  // on a cold start. The store dedups the call otherwise.
  ionViewWillEnter(): void {
    this.store.loadConversations();
  }

  onQueryChange(value: string): void {
    this.people.setQuery(value);
  }

  openPerson(person: RecentPerson): void {
    const existing = this.store.findDirectWith(person.id);
    if (existing) {
      this.openConversation(existing);
      return;
    }
    void this._router.navigate(['/tabs/messages/new'], {
      queryParams: { to: person.id, name: person.name },
      replaceUrl: true,
    });
  }

  openConversation(conversation: ConversationListItem): void {
    void this._router.navigate(['/tabs/messages', conversation.id], { replaceUrl: true });
  }

  /** Each call fails on its own: a missing list is left out, the field still works. */
  private _loadCoaches(): void {
    this._clientService
      .getMyInstructors()
      .pipe(
        take(1),
        catchError(() => of([])),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((rows) => {
        this._myCoaches.set(rows ?? []);
        this._myCoachesLoading.set(false);
      });

    this._profileService
      .suggestedInstructors(SUGGESTION_LIMIT)
      .pipe(
        take(1),
        catchError(() => of([])),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((coaches) => {
        this._suggestedCoaches.set(coaches ?? []);
        this._suggestedLoading.set(false);
      });
  }
}
