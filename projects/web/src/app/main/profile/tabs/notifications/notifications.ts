import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  CategoryPreferenceView,
  ConfigurableChannelPreferences,
  NotificationCategory,
  NotificationService,
  UpdatePreferencesPayload,
} from 'core';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';

/**
 * Profile → Notifications tab.
 *
 * Six category rows, one Email toggle each. The bell ("in-app") is
 * always-on by design and not shown here. Push and SMS aren't
 * implemented yet so we don't show them — when push ships we add a
 * column without changing this component's logic.
 *
 * Edit tracking lives in a Map<category, channels> signal so we can
 * diff against the server state and PATCH only the changed rows.
 */
@Component({
  selector: 'mh-profile-notifications',
  imports: [
    ButtonDirective,
    CardModule,
    SkeletonModule,
    ToggleSwitchModule,
    ToastModule,
    Tooltip,
    FormsModule,
    TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class ProfileNotifications implements OnInit {
  private readonly _notificationService = inject(NotificationService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly preferences = signal<CategoryPreferenceView[]>([]);

  /**
   * The user's edits, indexed by category. We don't mutate
   * `preferences` directly — that's the server's truth. Edits live
   * here until save.
   */
  private readonly editsSignal = signal<
    Map<NotificationCategory, ConfigurableChannelPreferences>
  >(new Map());

  readonly hasChanges = computed(() => this.editsSignal().size > 0);

  /**
   * View model for the template — server preferences with any
   * pending edits overlaid. The toggle binds to channels.email so
   * UI reflects the merged (edits over server) state.
   */
  readonly rows = computed(() => {
    const edits = this.editsSignal();
    return this.preferences().map((row) => ({
      ...row,
      channels: edits.get(row.category) ?? row.channels,
    }));
  });

  ngOnInit(): void {
    this.loadPreferences();
  }

  loadPreferences(): void {
    this.loading.set(true);
    this._notificationService.getSettings().subscribe({
      next: (data) => {
        this.preferences.set(data);
        this.editsSignal.set(new Map());
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail: this._translateService.instant('profileTabs.notifications.toast.loadFailed'),
        });
      },
    });
  }

  /**
   * Toggle handler for the email column. If the new value matches
   * the server's last-saved state, the row drops out of edits —
   * nothing to save.
   */
  toggleEmail(category: NotificationCategory, value: boolean): void {
    const original = this.preferences().find(
      (p) => p.category === category,
    )?.channels;
    if (!original) return;

    const next = new Map(this.editsSignal());
    if (original.email === value) {
      next.delete(category);
    } else {
      next.set(category, { email: value });
    }
    this.editsSignal.set(next);
  }

  save(): void {
    const edits = this.editsSignal();
    if (edits.size === 0) return;

    this.saving.set(true);
    const payload: UpdatePreferencesPayload = {
      items: Array.from(edits.entries()).map(([category, channels]) => ({
        category,
        channels,
      })),
    };

    this._notificationService.updateSettings(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('toast.summary.saved'),
          detail: this._translateService.instant('profileTabs.notifications.toast.saved'),
        });
        // Reload from server so `isCustomized` flags refresh.
        this.loadPreferences();
      },
      error: () => {
        this.saving.set(false);
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail: this._translateService.instant('profileTabs.notifications.toast.saveFailed'),
        });
      },
    });
  }

  discard(): void {
    this.editsSignal.set(new Map());
  }

  resetCategory(category: NotificationCategory): void {
    this._notificationService.resetCategoryToDefault(category).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('profileTabs.notifications.toast.resetSummary'),
          detail: this._translateService.instant('profileTabs.notifications.toast.categoryReset'),
        });
        this.loadPreferences();
      },
      error: () => {
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail: this._translateService.instant('profileTabs.notifications.toast.categoryResetFailed'),
        });
      },
    });
  }

  resetAll(): void {
    this._notificationService.resetAllToDefault().subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('profileTabs.notifications.toast.resetSummary'),
          detail: this._translateService.instant('profileTabs.notifications.toast.allReset'),
        });
        this.loadPreferences();
      },
      error: () => {
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail: this._translateService.instant('profileTabs.notifications.toast.allResetFailed'),
        });
      },
    });
  }
}
