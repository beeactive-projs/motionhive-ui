import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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

  /**
   * On mobile the list and chat are mutually exclusive: when a conversation
   * is open (or compose mode is on) the right pane takes the screen and the
   * list hides; otherwise the list takes the screen. Drives the `has-active`
   * class — desktop ignores it and shows both columns side by side.
   */
  protected readonly hasActivePane = computed(
    () => !!this.store.activeId() || this.store.composeMode(),
  );

  protected onNewMessage(): void {
    this.store.enterComposeMode();
  }
}
