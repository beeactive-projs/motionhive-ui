import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import { MessagingService, UserBlock } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ACCOUNT_ICONS } from '../account.config';

/**
 * People this account has blocked, with a way back.
 *
 * Blocks live on `MessagingService` rather than a service of their own — there
 * is no separate blocked-users endpoint.
 */
@Component({
  selector: 'mh-blocked-users',
  imports: [
    DatePipe,
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './blocked-users.html',
  styleUrl: './blocked-users.scss',
})
export class BlockedUsers implements OnInit {
  private readonly _messagingService = inject(MessagingService);
  private readonly _feedbackService = inject(FeedbackService);

  readonly blocks = signal<UserBlock[]>([]);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly unblocking = signal<ReadonlySet<string>>(new Set());

  constructor() {
    addIcons(ACCOUNT_ICONS);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this._messagingService
      .listBlocks()
      .pipe(take(1))
      .subscribe({
        next: (blocks) => {
          this.blocks.set(blocks);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  nameOf(block: UserBlock): string {
    const blocked = block.blocked;
    if (!blocked) return 'Someone';
    const name = `${blocked.firstName ?? ''} ${blocked.lastName ?? ''}`.trim();
    return name || 'Someone';
  }

  isUnblocking(blockedId: string): boolean {
    return this.unblocking().has(blockedId);
  }

  unblock(block: UserBlock): void {
    const { blockedId } = block;
    if (this.isUnblocking(blockedId)) return;

    this._markUnblocking(blockedId, true);
    const previous = this.blocks();
    this.blocks.update((blocks) => blocks.filter((row) => row.blockedId !== blockedId));

    this._messagingService
      .unblock(blockedId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._markUnblocking(blockedId, false);
          void this._feedbackService.success(`${this.nameOf(block)} unblocked`);
        },
        error: (error: unknown) => {
          this._markUnblocking(blockedId, false);
          this.blocks.set(previous);
          void this._feedbackService.error(error, 'Could not unblock them.');
        },
      });
  }

  private _markUnblocking(blockedId: string, pending: boolean): void {
    this.unblocking.update((current) => {
      const next = new Set(current);
      if (pending) next.add(blockedId);
      else next.delete(blockedId);
      return next;
    });
  }
}
