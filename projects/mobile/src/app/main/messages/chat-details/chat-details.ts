import {
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRouterOutlet,
  IonSkeletonText,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { ConversationListItem, MessagingStore, UserBlockReason, displayName } from 'core';

import { BlockUserSheet } from '../_sheets/block-user-sheet/block-user-sheet';
import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { SettingsRow } from '../../../_shared/components/settings-row/settings-row';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { ProfileStacks, personBase, stackRootOf } from '../../../_shared/utils/stack-paths';
import { MESSAGING_ICONS } from '../messages.config';

/**
 * Conversation details, pushed from the chat's ⓘ button. Mute maps to the
 * conversation's notification preference, block to the same block the
 * Blocked users screen lists and undoes, and delete removes the chat for this
 * user only.
 */
@Component({
  selector: 'mh-chat-details',
  imports: [
    BlockUserSheet,
    ConfirmSheet,
    HexAvatar,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonTitle,
    IonToggle,
    IonToolbar,
    SettingsRow,
    TranslatePipe,
  ],
  templateUrl: './chat-details.html',
  styleUrl: './chat-details.scss',
})
export class ChatDetails {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _outlet = inject(IonRouterOutlet);
  /** The stack the chat was opened in; its links and back stay there. */
  private readonly _stack = stackRootOf(this._router.url);
  /**
   * Back on a cold load, and past a deleted thread: the Messages list, or
   * the stack the chat was opened from.
   */
  readonly backHref = this._stack ?? ProfileStacks.Messages;
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  readonly store = inject(MessagingStore);

  readonly conversationId = signal<string | null>(null);
  readonly muting = signal(false);
  readonly blockOpen = signal(false);
  readonly deleteOpen = signal(false);
  readonly deleting = signal(false);

  private readonly _deleteSheet = viewChild(ConfirmSheet);

  /**
   * The inbox row. It outlives its removal, so deleting or blocking doesn't
   * blank the page while the sheet closes and the inbox comes back.
   */
  readonly conversation = linkedSignal<
    { id: string | null; row: ConversationListItem | null },
    ConversationListItem | null
  >({
    source: () => {
      const id = this.conversationId();
      return { id, row: id ? (this.store.conversations().find((c) => c.id === id) ?? null) : null };
    },
    computation: ({ id, row }, previous) =>
      row ?? (previous?.value?.id === id ? previous.value : null),
  });

  readonly otherUser = computed(() => this.conversation()?.otherUser ?? null);

  readonly name = computed(() =>
    displayName(this.otherUser(), this._translateService.instant('messages.details.thisPerson')),
  );

  readonly tone = computed(() => avatarToneFor(this.otherUser()?.id));

  readonly avatarUrl = computed(() => this.otherUser()?.avatarUrl ?? null);

  readonly muted = computed(() => this.conversation()?.muted ?? false);

  /**
   * A permalink lands before the inbox row it reads from. Only while that
   * load runs: a row that never turns up falls back to "this person".
   */
  readonly showHeroSkeleton = computed(() => !this.conversation() && this.store.loading());

  constructor() {
    addIcons(MESSAGING_ICONS);

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.conversationId.set(id);
      // A permalink into details can land before the inbox list has loaded, in
      // which case there is no conversation to render — ask for it.
      if (id && !this.conversation()) this.store.loadConversations();
    });
  }

  readonly handle = computed(() => this.otherUser()?.handle ?? null);

  openProfile(): void {
    const handle = this.handle();
    if (handle) void this._router.navigate([personBase(this._stack), handle]);
  }

  async toggleMute(): Promise<void> {
    const conversation = this.conversation();
    if (!conversation || this.muting()) return;

    const wasMuted = conversation.muted;
    this.muting.set(true);
    const ok = await this.store.toggleMute(conversation.id);
    this.muting.set(false);

    if (!ok) {
      void this._feedbackService.error(
        null,
        this._translateService.instant('messages.toast.muteFailed'),
      );
      return;
    }

    void this._feedbackService.success(
      this._translateService.instant(
        wasMuted ? 'messages.toast.notificationsOn' : 'messages.toast.notificationsMuted',
      ),
    );
  }

  /**
   * Delete for me only, then back to the inbox. The store only routes away
   * from the thread on screen, and the chat stopped being that when this page
   * was pushed over it, so the leaving is done here.
   */
  async deleteChat(): Promise<void> {
    const conversation = this.conversation();
    if (!conversation || this.deleting()) return;

    this.deleting.set(true);
    const ok = await this.store.deleteConversation(conversation.id);
    this.deleting.set(false);

    if (!ok) {
      void this._feedbackService.error(
        null,
        this._translateService.instant('messages.toast.deleteFailed'),
      );
      return;
    }

    // Close before routing, or the sheet is stranded over the inbox.
    await this._deleteSheet()?.close();
    void this._feedbackService.success(this._translateService.instant('messages.toast.deleted'));
    // Off the thread that no longer exists: to the inbox on the Messages
    // tab, and elsewhere back past it to the screen that opened it.
    if (this._stack && this._stack !== ProfileStacks.Messages && this._outlet.canGoBack(2)) {
      await this._outlet.pop(2);
      return;
    }
    // `replaceUrl`, so Back cannot return to a thread that no longer exists.
    await this._router.navigateByUrl(this.backHref, { replaceUrl: true });
  }

  /** The reason is optional moderation metadata on the BE; the sheet collects it
   *  and the confirmation in one step. */
  async block(reason: UserBlockReason): Promise<void> {
    const conversation = this.conversation();
    const blockedId = this.otherUser()?.id;
    if (!conversation || !blockedId) return;

    const ok = await this.store.blockUser({
      blockedId,
      reason,
      conversationId: conversation.id,
    });

    if (!ok) {
      void this._feedbackService.error(
        null,
        this._translateService.instant('messages.toast.blockFailed'),
      );
      return;
    }

    // The store drops the conversation and routes back to the inbox itself.
    void this._feedbackService.success(
      this._translateService.instant('messages.toast.blocked', { name: this.name() }),
    );
  }
}
