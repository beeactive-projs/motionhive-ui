import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
  NavController,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import {
  AppModeStore,
  AuthService,
  LanguageService,
  WEB_APP_URL,
  appLocale,
  languageName,
} from 'core';

import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { SettingsRow } from '../../_shared/components/settings-row/settings-row';
import { ROLES } from '../../_shared/config/roles.config';
import { resolveMode } from '../../_shared/config/tabs.config';
import { FeedbackService } from '../../_shared/services/feedback.service';
import {
  ThemePreference,
  ThemePreferences,
  ThemeService,
} from '../../_shared/services/theme.service';
import { ACCOUNT_ICONS } from './account.config';
import { AccountStore } from './account.store';
import { PhotoSheet } from './_sheets/photo-sheet/photo-sheet';
import { ShareSheet } from './_sheets/share-sheet/share-sheet';

/** Translation keys — shared with Manage account's radio group. */
export const THEME_LABEL_KEYS: Record<ThemePreference, string> = {
  [ThemePreferences.System]: 'account.theme.system',
  [ThemePreferences.Light]: 'account.theme.light',
  [ThemePreferences.Dark]: 'account.theme.dark',
};

/**
 * The account hub: who you are, and the way in to everything account-shaped.
 * Replaces the old Settings page — the theme control now lives on Manage
 * account, surfaced here as a value row.
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
    PhotoSheet,
    SettingsRow,
    ShareSheet,
    TranslatePipe,
  ],
  templateUrl: './account.html',
  styleUrl: './account.scss',
})
export class Account implements OnInit, ViewWillEnter {
  private readonly _router = inject(Router);
  private readonly _navController = inject(NavController);
  private readonly _appModeStore = inject(AppModeStore);
  private readonly _authService = inject(AuthService);
  private readonly _themeService = inject(ThemeService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _languageService = inject(LanguageService);

  readonly store = inject(AccountStore);

  readonly photoSheetOpen = signal(false);
  readonly shareSheetOpen = signal(false);
  readonly signingOut = signal(false);

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
  readonly themeLabel = computed(() =>
    this._translateService.instant(THEME_LABEL_KEYS[this._themeService.preference()]),
  );
  /** Named the way the pill names it — "Coach"/"Trainee", never the mode word. */
  readonly roleLabel = computed(
    () => ROLES[resolveMode(this.isInstructor(), this._appModeStore.mode())].label,
  );

  readonly memberSince = computed(() => {
    const createdAt = this.account()?.createdAt;
    if (!createdAt) return null;
    return new Date(createdAt).toLocaleDateString(appLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  });

  /** The UI language — what this device renders in, which the account mirrors. */
  readonly languageLabel = languageName(this._languageService.current);

  readonly timezoneLabel = computed(
    () => this.account()?.timezone ?? this._translateService.instant('form.placeholder.notSet'),
  );

  constructor() {
    addIcons(ACCOUNT_ICONS);
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

  /** Same destination as the home pill — a page that explains what a switch changes. */
  openSwitchRole(): void {
    void this._router.navigateByUrl('/tabs/home/switch-role');
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
    this._authService.logout().subscribe({
      next: () => this._leaveSession(),
      // Even if the server call fails (e.g. offline), drop the local session so
      // the user still lands back on the login page.
      error: () => {
        this.signingOut.set(false);
        this.store.reset();
        this._authService.clearAuthDataAndRedirect();
      },
    });
  }

  private _leaveSession(): void {
    this.store.reset();
    void this._navController.navigateRoot('/auth/login');
  }
}
