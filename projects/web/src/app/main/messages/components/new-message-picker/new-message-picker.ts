import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import {
  displayName,
  groupMessages,
  initialsOf,
  injectIsMobile,
  MessagingStore,
  UserSearchResult,
  UserService,
} from 'core';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { ChatComposer } from '../chat-composer/chat-composer';
import { MessageBubble } from '../message-bubble/message-bubble';

/**
 * New Message picker. Rents the right pane (or the full screen on
 * mobile) while `MessagingStore.composeMode` is true. Flow:
 *
 *   1. User types in the search field → debounced `/users/search`.
 *   2. User clicks a result → chip pinned at the top, composer enabled.
 *   3. User types message + sends → store creates the conversation,
 *      exits compose mode, routes to `/messages/:newId`.
 *
 * No "groups" support — disabled per plan §14. No multi-select for v1.
 */
@Component({
  selector: 'mh-new-message-picker',
  standalone: true,
  imports: [FormsModule, HexAvatar, ChatComposer, MessageBubble],
  templateUrl: './new-message-picker.html',
  styleUrl: './new-message-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewMessagePicker {
  protected readonly store = inject(MessagingStore);
  private readonly _users = inject(UserService);
  private readonly _destroyRef = inject(DestroyRef);

  /** Bottom-sheet presentation on phones; right-pane panel on larger screens. */
  protected readonly isMobile = injectIsMobile();

  protected readonly query = signal('');
  protected readonly results = signal<UserSearchResult[]>([]);
  protected readonly searching = signal(false);
  protected readonly selected = signal<UserSearchResult | null>(null);

  protected readonly canShowResults = computed(
    () =>
      !this.selected() &&
      (this.query().trim().length >= 2 || this.searching()),
  );

  private readonly query$ = new Subject<string>();

  /**
   * Messages already sent to the picked person while their conversation
   * is still being created. Rendering them here is what makes a first
   * message behave like every other one: the bubble is on screen
   * immediately, and the thread we navigate to already contains it.
   * Everything shown here was sent by us, hence `mine` is always true.
   */
  protected readonly pendingBubbles = computed(() =>
    groupMessages(this.store.pendingMessagesFor(this.selected()?.id ?? null).items),
  );

  protected readonly recipientName = computed(() => {
    const u = this.selected();
    if (!u) return '';
    return displayName(u, u.email);
  });

  protected readonly placeholder = computed(() => {
    const u = this.selected();
    if (!u) return 'Pick someone to message…';
    return `Message ${u.firstName ?? u.email}…`;
  });

  constructor() {
    this.query$
      .pipe(
        debounceTime(220),
        switchMap((q) => {
          const trimmed = q.trim();
          if (trimmed.length < 2) {
            this.searching.set(false);
            this.results.set([]);
            return [];
          }
          this.searching.set(true);
          return this._users.search({ q: trimmed, limit: 10 });
        }),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (rows) => {
          this.results.set(rows);
          this.searching.set(false);
        },
        error: () => {
          this.searching.set(false);
          this.results.set([]);
        },
      });
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
    this.query$.next(value);
  }

  protected onSelect(user: UserSearchResult): void {
    // Already talking to them: open the thread rather than composing a
    // "new" message into it. Saves the round trip that would resolve to
    // the same conversation, and the history is right there.
    const existing = this.store.findDirectWith(user.id);
    if (existing) {
      this.store.exitComposeMode();
      this.store.openConversation(existing.id);
      return;
    }

    this.selected.set(user);
    this.results.set([]);
    this.query.set('');
  }

  protected clearSelection(): void {
    this.selected.set(null);
  }

  protected onCancel(): void {
    this.store.exitComposeMode();
  }

  protected initials(u: UserSearchResult): string {
    const out = initialsOf(u);
    return out !== '?' ? out : u.email.charAt(0).toUpperCase() || '?';
  }

  protected nameOf(u: UserSearchResult): string {
    return displayName(u, u.email);
  }
}
