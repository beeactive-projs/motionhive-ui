import { Component, OnInit, afterNextRender, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonText,
  IonTitle,
  IonToolbar,
  LoadingController,
  NavController,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  AuthService,
  LanguageService,
  ProfileService,
  TIMEZONE_OPTIONS,
  WEB_APP_URL,
  appLocale,
  deleteAccountUrl,
  languageName,
  timezonePlace,
} from 'core';

import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { SettingsRow } from '../../_shared/components/settings-row/settings-row';
import { FeedbackService } from '../../_shared/services/feedback.service';
import {
  ThemePreference,
  ThemePreferences,
  ThemeService,
} from '../../_shared/services/theme.service';
import { ACCOUNT_ICONS } from './account.config';
import { AccountStore } from './account.store';
import { ChoiceOption, ChoiceSheet } from './_sheets/choice-sheet/choice-sheet';
import { PhotoSheet } from './_sheets/photo-sheet/photo-sheet';
import { ShareSheet } from './_sheets/share-sheet/share-sheet';
import { DETAIL_TILES } from '../../_shared/config/detail-tiles.config';

/** Translation keys for the appearance row's value and its sheet. */
export const THEME_LABEL_KEYS: Record<ThemePreference, string> = {
  [ThemePreferences.System]: 'account.theme.system',
  [ThemePreferences.Light]: 'account.theme.light',
  [ThemePreferences.Dark]: 'account.theme.dark',
};

/**
 * The account hub: who you are, and one row per setting. Appearance, language
 * and time zone are chosen right here in a sheet; privacy, notifications and
 * blocked people have their own pages; deleting the account opens the
 * website's steps.
 */
@Component({
  selector: 'mh-account',
  imports: [
    HexAvatar,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonList,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonText,
    IonTitle,
    IonToolbar,
    ChoiceSheet,
    PhotoSheet,
    SettingsRow,
    ShareSheet,
    TranslatePipe,
  ],
  templateUrl: './account.html',
  styleUrl: './account.scss',
})
export class Account implements OnInit, ViewWillEnter {
  readonly Tiles = DETAIL_TILES;

  private readonly _router = inject(Router);
  private readonly _navController = inject(NavController);
  private readonly _loadingController = inject(LoadingController);
  private readonly _authService = inject(AuthService);
  private readonly _profileService = inject(ProfileService);
  private readonly _themeService = inject(ThemeService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _languageService = inject(LanguageService);

  readonly store = inject(AccountStore);

  readonly photoSheetOpen = signal(false);
  readonly shareSheetOpen = signal(false);
  readonly appearanceOpen = signal(false);
  readonly languageOpen = signal(false);
  readonly timezoneOpen = signal(false);
  readonly signingOut = signal(false);
  readonly switchingLanguage = signal(false);
  readonly savingTimezone = signal(false);
  readonly resendingVerification = signal(false);

  readonly account = this.store.account;
  readonly isInstructor = this.store.isInstructor;
  readonly isVerified = computed(() => this.store.instructorProfile()?.isVerified === true);
  /** Only worth saying when it's true — "Not accepting" belongs on the page itself. */
  readonly acceptingBadge = computed(() =>
    this.store.instructorProfile()?.isAcceptingClients
      ? this._translateService.instant('account.rows.accepting')
      : null,
  );
  readonly handle = computed(() => this.account()?.handle ?? null);
  readonly themePreference = this._themeService.preference;
  readonly themeLabel = computed(() =>
    this._translateService.instant(THEME_LABEL_KEYS[this.themePreference()]),
  );
  /** System first, as phones list it: following the phone is the default. */
  readonly themeOptions: ChoiceOption[] = [
    ThemePreferences.System,
    ThemePreferences.Light,
    ThemePreferences.Dark,
  ].map((preference) => ({
    value: preference,
    label: this._translateService.instant(THEME_LABEL_KEYS[preference]),
    hint:
      preference === ThemePreferences.System
        ? this._translateService.instant('account.theme.systemHint')
        : undefined,
  }));

  readonly memberSince = computed(() => {
    const createdAt = this.account()?.createdAt;
    if (!createdAt) return null;
    return new Date(createdAt).toLocaleDateString(appLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  });

  /** The UI language: what this device renders in, which the account mirrors. */
  readonly currentLanguage = this._languageService.current;
  readonly languageLabel = languageName(this.currentLanguage);
  /** Each language named in itself, so someone lost in the wrong one can still find theirs. */
  readonly languageOptions: ChoiceOption[] = this._languageService.languages.map((value) => ({
    value,
    label: this._translateService.instant(`language.${value}`),
  }));

  readonly timezone = computed(() => this.account()?.timezone ?? null);
  readonly timezoneLabel = computed(() => {
    const timezone = this.timezone();
    return timezone
      ? timezonePlace(timezone)
      : this._translateService.instant('form.placeholder.notSet');
  });
  /**
   * About 400 rows, built just after the page first paints rather than with
   * it; the sheet draws them a page at a time.
   */
  readonly timezoneOptions = signal<readonly ChoiceOption[]>([]);

  /** The account's email while it is unverified, else null (no resend row). */
  readonly unverifiedEmail = computed(() => {
    const account = this.account();
    return account && !account.isEmailVerified ? account.email : null;
  });

  constructor() {
    addIcons(ACCOUNT_ICONS);
    afterNextRender(() => setTimeout(() => this.timezoneOptions.set(TIMEZONE_OPTIONS)));
  }

  ngOnInit(): void {
    this.store.ensureLoaded();
  }

  /** Tab pages stay alive, so returning from a sheet-driven edit lands here. */
  ionViewWillEnter(): void {
    this.store.ensureLoaded();
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.refresh(() => void event.target.complete());
  }

  go(path: string): void {
    void this._router.navigateByUrl(`/tabs/home/account/${path}`);
  }

  onThemePicked(value: string): void {
    const preference = Object.values(ThemePreferences).find((candidate) => candidate === value);
    if (preference) this._themeService.setPreference(preference);
  }

  /**
   * The switch saves to the account, then reloads the app. Cover that wait so
   * the screen doesn't look like nothing happened.
   */
  async onLanguagePicked(value: string): Promise<void> {
    const language = this._languageService.languages.find((candidate) => candidate === value);
    if (!language || this.switchingLanguage()) return;
    this.switchingLanguage.set(true);
    const loading = await this._loadingController.create({
      message: this._translateService.instant('account.language.switching'),
    });
    await loading.present();
    this._languageService.use(language);
  }

  onTimezonePicked(timezone: string): void {
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

  /** The website's steps, in the reader's language: the page the store listings link to. */
  openDeleteAccount(): void {
    window.open(deleteAccountUrl(this.currentLanguage), '_blank', 'noopener');
  }

  async copyHandle(): Promise<void> {
    const handle = this.handle();
    if (!handle) return;
    try {
      await navigator.clipboard.writeText(`${WEB_APP_URL}/@${handle}`);
      await this._feedbackService.success(this._translateService.instant('toast.detail.linkCopied'));
    } catch {
      await this._feedbackService.error(null, this._translateService.instant('account.toast.copyFailed'));
    }
  }

  openPublicProfile(): void {
    const handle = this.handle();
    if (!handle) return;
    window.open(`${WEB_APP_URL}/@${handle}`, '_blank', 'noopener');
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
