import { Component, OnInit, afterNextRender, computed, inject, signal } from '@angular/core';
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
  IonSpinner,
  IonTitle,
  IonToolbar,
  LoadingController,
  NavController,
  SelectCustomEvent,
} from '@ionic/angular/standalone';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  AppLanguage,
  AuthService,
  LanguageService,
  ProfileService,
  TIMEZONE_OPTIONS,
} from 'core';

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
    IonSpinner,
    IonTitle,
    IonToolbar,
    TranslatePipe,
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
  private readonly _translateService = inject(TranslateService);
  private readonly _languageService = inject(LanguageService);
  private readonly _loadingController = inject(LoadingController);

  readonly store = inject(AccountStore);

  readonly ThemePreferences = ThemePreferences;
  readonly timezones = TIMEZONE_OPTIONS;

  /**
   * `TIMEZONE_OPTIONS` is ~400 entries and `ion-select-option`s are real
   * elements whether the select is open or not, so they mount just after the
   * page first paints rather than with it. Not on focus: iOS opens a select on
   * tap before it takes focus, which left the first open blank.
   */
  readonly timezonesMounted = signal(false);
  readonly switchingLanguage = signal(false);
  readonly savingTimezone = signal(false);
  readonly signingOut = signal(false);
  readonly resendingVerification = signal(false);

  readonly account = this.store.account;
  readonly timezone = computed(() => this.account()?.timezone ?? null);
  /** The account's email while it is unverified, else null (no resend row). */
  readonly unverifiedEmail = computed(() => {
    const account = this.account();
    return account && !account.isEmailVerified ? account.email : null;
  });
  readonly currentLanguage = this._languageService.current;
  readonly languageSheetOptions = {
    header: this._translateService.instant('form.label.language'),
  };
  /** Each language named in itself — someone lost in the wrong one can still find theirs. */
  readonly languageOptions = this._languageService.languages.map((value) => ({
    value,
    label: this._translateService.instant(`language.${value}`),
  }));

  constructor() {
    addIcons(ACCOUNT_ICONS);
    afterNextRender(() => setTimeout(() => this.timezonesMounted.set(true)));
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

  /**
   * The switch saves to the account, then reloads the app. Cover that wait so
   * the screen doesn't look like nothing happened.
   */
  async onLanguageChange(event: SelectCustomEvent<AppLanguage>): Promise<void> {
    const language = event.detail.value;
    if (language === this.currentLanguage || this.switchingLanguage()) return;
    this.switchingLanguage.set(true);
    const loading = await this._loadingController.create({
      message: this._translateService.instant('account.manage.switchingLanguage'),
    });
    await loading.present();
    this._languageService.use(language);
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
          void this._feedbackService.success(
            this._translateService.instant('account.toast.timezoneUpdated'),
          );
        },
        error: (error: unknown) => {
          this.savingTimezone.set(false);
          this.store.patchAccount({ timezone: previous });
          void this._feedbackService.error(
            error,
            this._translateService.instant('account.toast.timezoneFailed'),
          );
        },
      });
  }

  /**
   * Re-sends the email-verification link, the one the verify-email page's
   * "request a new one" points to. The API is rate limited and idempotent.
   */
  onResendVerification(): void {
    const email = this.unverifiedEmail();
    if (!email || this.resendingVerification()) return;
    this.resendingVerification.set(true);
    this._authService
      .resendVerification(email)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.resendingVerification.set(false);
          void this._feedbackService.success(
            this._translateService.instant('account.toast.verificationSent', { email }),
          );
        },
        error: (error: unknown) => {
          this.resendingVerification.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('account.toast.verificationFailed'),
          );
        },
      });
  }

  onSignOut(): void {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    // logout() ends the local session even when the request fails (offline),
    // so either way the user lands back on the login page.
    this._authService.logout().subscribe({
      next: () => this._leaveSession(),
      error: () => this._leaveSession(),
    });
  }

  private _leaveSession(): void {
    this.store.reset();
    void this._navController.navigateRoot('/auth/login');
  }
}
