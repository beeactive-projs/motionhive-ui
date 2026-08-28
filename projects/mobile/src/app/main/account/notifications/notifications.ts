import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

import {
  CategoryPreferenceView,
  ConfigurableChannelPreferences,
  NotificationCategory,
  NotificationService,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { SettingsRow } from '../../../_shared/components/settings-row/settings-row';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import {
  CategoryStyle,
  categoryStyle,
} from '../../../_shared/config/notification-categories.config';
import { ACCOUNT_ICONS } from '../account.config';
import {
  CategoryPreferenceSheet,
  ChannelChange,
} from './_sheets/category-preference-sheet/category-preference-sheet';
import { channelSummary } from './notification-preferences.config';

/**
 * Which channels each category reaches you on. In-app is always on — the bell
 * is the inbox — so the page is a list of categories, and a sheet per category
 * holds the channels the API lets you set (email today, push when it ships).
 *
 * The rows, their labels and their descriptions all come from the server, so a
 * category added there appears here with no code change. Each toggle commits on
 * flip rather than through a Save bar: every other switch on the phone works
 * that way, and web's batch-then-save is a desktop form idiom.
 */
@Component({
  selector: 'mh-account-notifications',
  imports: [
    CategoryPreferenceSheet,
    EmptyState,
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
    SettingsRow,
  ],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class AccountNotifications implements OnInit {
  private readonly _notificationService = inject(NotificationService);
  private readonly _feedbackService = inject(FeedbackService);

  readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7, 8];

  readonly categories = signal<CategoryPreferenceView[]>([]);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly resetting = signal(false);
  /** Categories with a write in flight, so their toggles can't be double-flipped. */
  readonly pending = signal<ReadonlySet<NotificationCategory>>(new Set());

  /** The category whose sheet is open, if any. */
  readonly selected = signal<NotificationCategory | null>(null);
  readonly sheetOpen = signal(false);

  /** Read off the list, so an optimistic flip — or its rollback — reaches the sheet. */
  readonly selectedPreference = computed(() => {
    const category = this.selected();
    return this.categories().find((row) => row.category === category) ?? null;
  });

  readonly selectedPending = computed(() => {
    const category = this.selected();
    return !!category && this.pending().has(category);
  });

  constructor() {
    addIcons(ACCOUNT_ICONS);
  }

  ngOnInit(): void {
    this.load();
  }

  /**
   * First load shows the skeleton; a reload behind rows already on screen
   * keeps them, so a per-category reset does not blank the page under the
   * open sheet.
   */
  load(): void {
    const quiet = this.categories().length > 0;
    if (!quiet) {
      this.loading.set(true);
      this.loadFailed.set(false);
    }
    this._notificationService
      .getSettings()
      .pipe(take(1))
      .subscribe({
        next: (categories) => {
          this.categories.set(categories);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          if (quiet) {
            void this._feedbackService.error(error, 'Could not refresh your preferences.');
          } else {
            this.loadFailed.set(true);
          }
        },
      });
  }

  styleFor(category: NotificationCategory): CategoryStyle {
    return categoryStyle(category);
  }

  summaryFor(row: CategoryPreferenceView): string {
    return channelSummary(row);
  }

  openCategory(category: NotificationCategory): void {
    this.selected.set(category);
    this.sheetOpen.set(true);
  }

  onChannelChanged(change: ChannelChange): void {
    const category = this.selected();
    const row = this.selectedPreference();
    if (!category || !row) return;

    const previous = row.channels;
    const channels = { ...previous, [change.channel]: change.enabled };
    this._setChannels(category, channels);
    this._markPending(category, true);

    this._notificationService
      .updateSettings({ items: [{ category, channels }] })
      .pipe(take(1))
      .subscribe({
        next: () => this._markPending(category, false),
        error: (error: unknown) => {
          this._markPending(category, false);
          this._setChannels(category, previous);
          void this._feedbackService.error(error, 'Could not save that preference.');
        },
      });
  }

  resetCategory(): void {
    const category = this.selected();
    if (!category || this.resetting()) return;
    this.resetting.set(true);
    this._notificationService
      .resetCategoryToDefault(category)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.resetting.set(false);
          void this._feedbackService.success('Reset to default');
          // The response only counts rows; the effective state needs a reload.
          this.load();
        },
        error: (error: unknown) => {
          this.resetting.set(false);
          void this._feedbackService.error(error, 'Could not reset this category.');
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

  private _setChannels(
    category: NotificationCategory,
    channels: ConfigurableChannelPreferences,
  ): void {
    this.categories.update((categories) =>
      categories.map((row) => (row.category === category ? { ...row, channels } : row)),
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
