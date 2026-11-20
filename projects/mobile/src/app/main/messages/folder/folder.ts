import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { ConversationFolder, ConversationListItem, MessagingStore } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { RowSkeleton } from '../../../_shared/components/row-skeleton/row-skeleton';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ConversationRow } from '../_components/conversation-row/conversation-row';
import { FOLDER_COPY, MESSAGING_ICONS, folderOf } from '../messages.config';

/**
 * Message requests, or archived chats: one screen over a folder of the
 * inbox, picked by the route's `folder` data (`messages.routes.ts`).
 *
 * Requests are only opened: the decision (Accept, Delete, Block) is in the
 * thread, where the message and who sent it can be read first. Archived chats
 * swipe left to come back. Both lists are the store's, fetched on their own
 * because they can sit past the inbox's loaded pages.
 */
@Component({
  selector: 'mh-conversation-folder',
  imports: [
    ConversationRow,
    EmptyState,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonList,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    RowSkeleton,
    TranslatePipe,
  ],
  templateUrl: './folder.html',
})
export class ConversationFolderPage implements ViewWillEnter {
  readonly store = inject(MessagingStore);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly folder = folderOf(inject(ActivatedRoute).snapshot.data);
  readonly copy = FOLDER_COPY[this.folder];
  readonly isRequests = this.folder === ConversationFolder.Requests;
  readonly skeletonRows = [1, 2, 3];

  readonly rows = computed<ConversationListItem[]>(() => {
    if (this.isRequests) {
      return this.store.requestConversations();
    }
    return this.store.archivedConversations();
  });

  /** The first fetch, with nothing to show yet. */
  readonly showSkeleton = computed(
    () => !this.store.folderLoaded(this.folder) && this.rows().length === 0,
  );

  readonly isEmpty = computed(
    () => this.store.folderLoaded(this.folder) && this.rows().length === 0,
  );

  constructor() {
    addIcons(MESSAGING_ICONS);
  }

  ionViewWillEnter(): void {
    this.store.loadFolder(this.folder);
  }

  open(conversation: ConversationListItem): void {
    this.store.openConversation(conversation.id);
  }

  async unarchive(conversation: ConversationListItem): Promise<void> {
    const ok = await this.store.setArchived(conversation.id, false);
    if (!ok) {
      void this._feedbackService.error(
        null,
        this._translateService.instant('messages.toast.archiveFailed'),
      );
      return;
    }
    void this._feedbackService.success(this._translateService.instant('messages.toast.unarchived'));
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.loadFolder(this.folder, { done: () => void event.target.complete() });
  }
}
