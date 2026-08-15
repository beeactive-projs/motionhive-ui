import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActionSheetController,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { BLOCK_REASONS, MessagingStore, UserBlockReason, displayName } from 'core';

import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { SettingsRow } from '../../../_shared/components/settings-row/settings-row';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { MESSAGING_ICONS } from '../messages.config';

/**
 * Conversation details, pushed from the chat's ⓘ button. Two rows: mute maps to
 * the conversation's notification preference, block to the same block the
 * Blocked users screen lists and undoes.
 */
@Component({
  selector: 'mh-chat-details',
  imports: [
    HexAvatar,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonTitle,
    IonToggle,
    IonToolbar,
    SettingsRow,
  ],
  templateUrl: './chat-details.html',
  styleUrl: './chat-details.scss',
})
export class ChatDetails {
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _actionSheetController = inject(ActionSheetController);
  private readonly _feedbackService = inject(FeedbackService);
  readonly store = inject(MessagingStore);

  readonly conversationId = signal<string | null>(null);
  readonly muting = signal(false);

  readonly conversation = computed(() => {
    const id = this.conversationId();
    if (!id) return null;
    return this.store.conversations().find((row) => row.id === id) ?? null;
  });

  readonly otherUser = computed(() => this.conversation()?.otherUser ?? null);

  readonly name = computed(() => displayName(this.otherUser(), 'this person'));

  readonly tone = computed(() => avatarToneFor(this.otherUser()?.id));

  readonly avatarUrl = computed(() => this.otherUser()?.avatarUrl ?? null);

  readonly muted = computed(() => this.conversation()?.muted ?? false);

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

  async toggleMute(): Promise<void> {
    const conversation = this.conversation();
    if (!conversation || this.muting()) return;

    const wasMuted = conversation.muted;
    this.muting.set(true);
    const ok = await this.store.toggleMute(conversation.id);
    this.muting.set(false);

    if (!ok) {
      void this._feedbackService.error(null, 'Could not update notifications.');
      return;
    }

    void this._feedbackService.success(
      wasMuted ? 'Notifications on' : 'Notifications muted',
    );
  }

  /** The reason is optional moderation metadata on the BE; the sheet collects it
   *  and the confirmation in one step. */
  async confirmBlock(): Promise<void> {
    const conversation = this.conversation();
    const blockedId = this.otherUser()?.id;
    if (!conversation || !blockedId) return;

    const sheet = await this._actionSheetController.create({
      header: `Block ${this.name()}?`,
      subHeader: 'They will not be able to message you, and you will not see this conversation.',
      buttons: [
        ...BLOCK_REASONS.map((reason) => ({
          text: reason.label,
          role: 'destructive',
          data: reason.value,
        })),
        { text: 'Cancel', role: 'cancel' },
      ],
    });

    await sheet.present();
    const { data, role } = await sheet.onDidDismiss<UserBlockReason>();
    if (role === 'cancel' || !data) return;

    const ok = await this.store.blockUser({
      blockedId,
      reason: data,
      conversationId: conversation.id,
    });

    if (!ok) {
      void this._feedbackService.error(null, 'Could not block them.');
      return;
    }

    // The store drops the conversation and routes back to the inbox itself.
    void this._feedbackService.success(`${this.name()} blocked`);
  }
}
