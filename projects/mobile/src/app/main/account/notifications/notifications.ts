import { Component, OnInit, inject, signal } from '@angular/core';
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
  IonToggle,
  IonToolbar,
  ToggleCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import { CategoryPreferenceView, NotificationCategory, NotificationService } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import {
  CategoryStyle,
  categoryStyle,
} from '../../../_shared/config/notification-categories.config';
import { ACCOUNT_ICONS } from '../account.config';

/**
 * Which categories also send email. In-app is always on — the bell is the inbox.
 *
 * The rows, their labels and their descriptions all come from the server, so a
 * category added there appears here with no code change. Each toggle commits on
 * flip rather than through a Save bar: every other switch on the phone works
 * that way, and web's batch-then-save is a desktop form idiom.
 */
@Component({
  selector: 'mh-account-notifications',
  imports: [
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
    IonToggle,
    IonToolbar,
  ],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class AccountNotifications implements OnInit {
  private readonly _notificationService = inject(NotificationService);
  private readonly _feedbackService = inject(FeedbackService);

  readonly categories = signal<CategoryPreferenceView[]>([]);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly resetting = signal(false);
  /** Categories with a PATCH in flight, so their row can't be double-flipped. */
  readonly pending = signal<ReadonlySet<NotificationCategory>>(new Set());

  constructor() {
    addIcons(ACCOUNT_ICONS);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this._notificationService
      .getSettings()
      .pipe(take(1))
      .subscribe({
        next: (categories) => {
          this.categories.set(categories);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  styleFor(category: NotificationCategory): CategoryStyle {
    return categoryStyle(category);
  }

  /**
   * Where the always-on copy of this category lands. Everything goes to the
   * bell except direct messages, which are suppressed there on purpose — the
   * Messages tab and its badge are that inbox, so claiming "in-app" for them
   * would point at a screen they never reach.
   */
  inAppLabel(category: NotificationCategory): string {
    return category === NotificationCategory.Messaging ? 'Messages' : 'In-app';
  }

  isPending(category: NotificationCategory): boolean {
    return this.pending().has(category);
  }

  onToggle(category: NotificationCategory, event: ToggleCustomEvent): void {
    const email = event.detail.checked;
    this._setEmail(category, email);
    this._markPending(category, true);

    this._notificationService
      .updateSettings({ items: [{ category, channels: { email } }] })
      .pipe(take(1))
      .subscribe({
        next: () => this._markPending(category, false),
        error: (error: unknown) => {
          this._markPending(category, false);
          this._setEmail(category, !email);
          void this._feedbackService.error(error, 'Could not save that preference.');
        },
      });
  }

  resetAll(): void {
    if (this.resetting()) return;
    this.resetting.set(true);
    this._notificationService
      .resetAllToDefault()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.resetting.set(false);
          void this._feedbackService.success('Reset to defaults');
          this.load();
        },
        error: (error: unknown) => {
          this.resetting.set(false);
          void this._feedbackService.error(error, 'Could not reset your preferences.');
        },
      });
  }

  private _setEmail(category: NotificationCategory, email: boolean): void {
    this.categories.update((categories) =>
      categories.map((row) =>
        row.category === category ? { ...row, channels: { ...row.channels, email } } : row,
      ),
    );
  }

  private _markPending(category: NotificationCategory, pending: boolean): void {
    this.pending.update((current) => {
      const next = new Set(current);
      if (pending) next.add(category);
      else next.delete(category);
      return next;
    });
  }
}
