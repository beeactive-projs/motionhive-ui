import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { MessagingStore } from 'core';
import { ConversationList } from '../../components/conversation-list/conversation-list';
import { NewMessagePicker } from '../../components/new-message-picker/new-message-picker';

/**
 * InboxPage — the messaging shell.
 *
 * F1: route + empty state.
 * F2: live conversation list on the left.
 * F3: conversation pane on the right (via <router-outlet>).
 * F4 (this stage): compose-mode flag. When `store.composeMode()` is
 *   true, the right pane shows <mh-new-message-picker> instead of the
 *   routed child. URL stays /messages — see plan §14 decision #3.
 *
 * "New group" remains disabled (groups deferred to a later release).
 *
 * `?to=<userId>` opens a direct thread with that person — the entry
 * point used by "Message" buttons elsewhere in the app (client roster,
 * client profile, public profile). Those links already existed and
 * silently did nothing, because nothing ever read the parameter.
 */
@Component({
  selector: 'mh-inbox-page',
  imports: [RouterOutlet, ConversationList, NewMessagePicker],
  templateUrl: './inbox-page.html',
  styleUrl: './inbox-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxPage {
  protected readonly store = inject(MessagingStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  /** Set from `?to=`; cleared once resolved so it fires exactly once. */
  private readonly _pendingDirectUserId = signal<string | null>(null);

  constructor() {
    const to = this._route.snapshot.queryParamMap.get('to');
    if (to) {
      this._pendingDirectUserId.set(to);
      this.store.loadConversations();
    }

    // The conversation list arrives asynchronously, so resolve once it
    // has landed rather than racing it.
    effect(() => {
      const userId = this._pendingDirectUserId();
      if (!userId || !this.store.hasLoaded()) return;

      const existing = this.store
        .conversations()
        .find((c) => c.type === 'DIRECT' && c.otherUser?.id === userId);

      this._pendingDirectUserId.set(null);

      if (existing) {
        void this._router.navigate(['/messages', existing.id], {
          replaceUrl: true,
        });
        return;
      }

      // No thread yet — open the picker so the first message starts one.
      this.store.enterComposeMode();
    });
  }

  /**
   * On mobile the list and chat are mutually exclusive: when a conversation
   * is open the chat takes the screen and the list hides; otherwise the list
   * takes the screen. Drives the `has-active` class — desktop ignores it and
   * shows both columns side by side.
   *
   * Compose mode is deliberately NOT folded in here: the new-message picker
   * renders as an overlay (a bottom sheet on mobile, a right-pane panel on
   * desktop), so the inbox list stays visible behind it.
   */
  protected readonly hasActivePane = computed(() => !!this.store.activeId());

  protected onNewMessage(): void {
    this.store.enterComposeMode();
  }
}
