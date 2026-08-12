import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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

import { AuthService, WEB_APP_URL } from 'core';

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
import { PhotoSheet } from './_sheets/photo-sheet/photo-sheet';
import { ShareSheet } from './_sheets/share-sheet/share-sheet';

const THEME_LABELS: Record<ThemePreference, string> = {
  [ThemePreferences.System]: 'System',
  [ThemePreferences.Light]: 'Light',
  [ThemePreferences.Dark]: 'Dark',
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
  ],
  templateUrl: './account.html',
  styleUrl: './account.scss',
})
export class Account implements OnInit, ViewWillEnter {
  private readonly _router = inject(Router);
  private readonly _navController = inject(NavController);
  private readonly _authService = inject(AuthService);
  private readonly _themeService = inject(ThemeService);
  private readonly _feedbackService = inject(FeedbackService);

  readonly store = inject(AccountStore);

  readonly photoSheetOpen = signal(false);
  readonly shareSheetOpen = signal(false);
  readonly signingOut = signal(false);

  readonly account = this.store.account;
  readonly isInstructor = this.store.isInstructor;
  readonly isVerified = computed(() => this.store.instructorProfile()?.isVerified === true);
  /** Only worth saying when it's true — "Not accepting" belongs on the page itself. */
  readonly acceptingBadge = computed(() =>
    this.store.instructorProfile()?.isAcceptingClients ? 'Accepting' : null,
  );
  readonly handle = computed(() => this.account()?.handle ?? null);
  readonly themeLabel = computed(() => THEME_LABELS[this._themeService.preference()]);

  readonly memberSince = computed(() => {
    const createdAt = this.account()?.createdAt;
    if (!createdAt) return null;
    return new Date(createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  });

  readonly languageLabel = computed(() => {
    const language = this.account()?.language;
    return language ? `English (${language})` : 'English (en)';
  });

  readonly timezoneLabel = computed(() => this.account()?.timezone ?? 'Not set');

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

  async copyHandle(): Promise<void> {
    const handle = this.handle();
    if (!handle) return;
    try {
      await navigator.clipboard.writeText(`${WEB_APP_URL}/@${handle}`);
      await this._feedbackService.success('Link copied');
    } catch {
      await this._feedbackService.error(null, 'Could not copy the link.');
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
