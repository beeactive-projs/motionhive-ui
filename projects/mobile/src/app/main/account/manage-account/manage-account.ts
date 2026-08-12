import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonBadge,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  NavController,
  SelectCustomEvent,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import { AuthService, ProfileService, TIMEZONE_OPTIONS } from 'core';

import { SettingsRow } from '../../../_shared/components/settings-row/settings-row';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import {
  ThemePreference,
  ThemePreferences,
  ThemeService,
} from '../../../_shared/services/theme.service';
import { ACCOUNT_ICONS } from '../account.config';
import { AccountStore } from '../account.store';

/**
 * Preferences that are not about identity, plus the two destructive actions.
 *
 * This is where the old Settings page's Appearance control landed when Account
 * replaced it — a device preference belongs with language and timezone rather
 * than on the hub.
 */
@Component({
  selector: 'mh-manage-account',
  imports: [
    IonBackButton,
    IonBadge,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonRadio,
    IonRadioGroup,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './manage-account.html',
  styleUrl: './manage-account.scss',
})
export class ManageAccount implements OnInit {
  private readonly _themeService = inject(ThemeService);
  private readonly _profileService = inject(ProfileService);
  private readonly _authService = inject(AuthService);
  private readonly _navController = inject(NavController);
  private readonly _feedbackService = inject(FeedbackService);

  readonly store = inject(AccountStore);

  readonly ThemePreferences = ThemePreferences;
  readonly timezones = TIMEZONE_OPTIONS;

  /**
   * `TIMEZONE_OPTIONS` is ~400 entries and `ion-select-option`s are real
   * elements whether the select is open or not. Mounting them on first focus
   * keeps that cost off the page load.
   */
  readonly timezonesMounted = signal(false);
  readonly savingTimezone = signal(false);
  readonly signingOut = signal(false);

  readonly account = this.store.account;
  readonly timezone = computed(() => this.account()?.timezone ?? null);
  readonly languageLabel = computed(() => {
    const language = this.account()?.language;
    return language ? `English (${language})` : 'English (en)';
  });

  constructor() {
    addIcons(ACCOUNT_ICONS);
  }

  ngOnInit(): void {
    this.store.ensureLoaded();
  }

  themePreference(): ThemePreference {
    return this._themeService.preference();
  }

  onThemeChange(preference: ThemePreference): void {
    this._themeService.setPreference(preference);
  }

  onTimezoneChange(event: SelectCustomEvent<string>): void {
    const timezone = event.detail.value;
    const previous = this.timezone();
    if (!timezone || timezone === previous) return;

    this.savingTimezone.set(true);
    this.store.patchAccount({ timezone });
    this._profileService
      .updateMyProfile({ account: { timezone } })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.savingTimezone.set(false);
          void this._feedbackService.success('Timezone updated');
        },
        error: (error: unknown) => {
          this.savingTimezone.set(false);
          this.store.patchAccount({ timezone: previous });
          void this._feedbackService.error(error, 'Could not update your timezone.');
        },
      });
  }

  onSignOut(): void {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    this._authService.logout().subscribe({
      next: () => {
        this.store.reset();
        void this._navController.navigateRoot('/auth/login');
      },
      error: () => {
        this.signingOut.set(false);
        this.store.reset();
        this._authService.clearAuthDataAndRedirect();
      },
    });
  }
}
